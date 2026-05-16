import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { env } from '@/lib/env'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()

  const { data: expired, error } = await supabase
    .from('analyses')
    .select('id, user_id, image_url')
    .lt('original_expires_at', new Date().toISOString())
    .is('original_deleted_at', null)
    .not('image_url', 'is', null)
    .limit(50)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!expired || expired.length === 0) {
    return NextResponse.json({ deleted: 0 })
  }

  let deleted = 0
  const errors: string[] = []

  for (const analysis of expired) {
    if (!analysis.image_url) continue

    const { error: storageError } = await supabase.storage
      .from('images')
      .remove([analysis.image_url])

    if (storageError) {
      errors.push(`${analysis.id}: ${storageError.message}`)
      continue
    }

    await supabase
      .from('analyses')
      .update({ original_deleted_at: new Date().toISOString() })
      .eq('id', analysis.id)

    deleted++
  }

  return NextResponse.json({ deleted, errors: errors.length > 0 ? errors : undefined })
}
