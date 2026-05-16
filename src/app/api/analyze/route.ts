import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { processImage } from '@/lib/image/process'
import { checkCredits } from '@/lib/credits'
import { env } from '@/lib/env'
import { Client as QStashClient } from '@upstash/qstash'
import type { Locale } from '@/lib/ai/prompts'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

export async function POST(req: NextRequest) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const hasCredits = await checkCredits(user.id, supabase)
  if (!hasCredits) {
    return NextResponse.json({ error: 'Insufficient credits' }, { status: 402 })
  }

  const formData = await req.formData()
  const image = formData.get('image') as File | null
  const locale = ((formData.get('locale') as string) ?? 'ko') as Locale

  if (!image) {
    return NextResponse.json({ error: 'Image required' }, { status: 400 })
  }
  if (image.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: 'Image too large (max 10MB)' }, { status: 400 })
  }

  const imageBuffer = Buffer.from(await image.arrayBuffer())
  const { original, thumbnail } = await processImage(imageBuffer)

  const analysisId = crypto.randomUUID()
  const basePath = `${user.id}/${analysisId}`

  const [{ error: origError }, { error: thumbError }] = await Promise.all([
    supabase.storage.from('images').upload(`${basePath}/original.jpg`, original, {
      contentType: 'image/jpeg',
    }),
    supabase.storage.from('images').upload(`${basePath}/thumb.jpg`, thumbnail, {
      contentType: 'image/jpeg',
    }),
  ])

  if (origError || thumbError) {
    return NextResponse.json({ error: 'Storage upload failed' }, { status: 500 })
  }

  const { data: thumbSigned } = await supabase.storage
    .from('images')
    .createSignedUrl(`${basePath}/thumb.jpg`, 60 * 60 * 24 * 365)

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

  const { error: dbError } = await supabase.from('analyses').insert({
    id: analysisId,
    user_id: user.id,
    image_url: `${basePath}/original.jpg`,
    thumbnail_url: thumbSigned?.signedUrl ?? '',
    locale,
    status: 'validating',
    original_expires_at: expiresAt,
  })

  if (dbError) {
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  const qstash = new QStashClient({ token: env.QSTASH_TOKEN, baseUrl: env.QSTASH_URL })
  try {
    await qstash.publishJSON({
      url: `${env.NEXT_PUBLIC_APP_URL}/api/worker/analyze`,
      body: { analysis_id: analysisId },
      retries: 2,
    })
  } catch {
    // Worker never queued — mark failed so the row doesn't stay stuck at 'validating'
    await supabase.from('analyses').update({ status: 'failed' }).eq('id', analysisId)
    return NextResponse.json({ error: 'Failed to queue analysis' }, { status: 500 })
  }

  return NextResponse.json({ analysis_id: analysisId })
}
