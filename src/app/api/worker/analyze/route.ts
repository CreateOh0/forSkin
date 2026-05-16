import { NextRequest, NextResponse } from 'next/server'
import { Receiver } from '@upstash/qstash'
import { createAdminClient } from '@/lib/supabase/admin'
import { validateFace } from '@/lib/ai/validate-face'
import { analyzeSkin } from '@/lib/ai/analyze-skin'
import { deductCredit, refundCredit } from '@/lib/credits'
import { env } from '@/lib/env'
import type { Locale, SkinAnalysisResult } from '@/lib/ai/prompts'
import type { AnalysisStatus, Json } from '@/lib/supabase/types'

const TERMINAL_STATUSES: AnalysisStatus[] = ['completed', 'failed']

export async function POST(req: NextRequest) {
  const receiver = new Receiver({
    currentSigningKey: env.QSTASH_CURRENT_SIGNING_KEY,
    nextSigningKey: env.QSTASH_NEXT_SIGNING_KEY,
  })

  const body = await req.text()
  const signature = req.headers.get('upstash-signature') ?? ''

  const isValid = await receiver
    .verify({
      signature,
      body,
      url: `${env.NEXT_PUBLIC_APP_URL}/api/worker/analyze`,
    })
    .catch(() => false)

  if (!isValid) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const { analysis_id } = JSON.parse(body) as { analysis_id: string }

  const supabase = createAdminClient()

  const updateStatus = async (status: AnalysisStatus) => {
    await supabase.from('analyses').update({ status }).eq('id', analysis_id)
  }

  const { data: analysis } = await supabase
    .from('analyses')
    .select('image_url, locale, status, user_id')
    .eq('id', analysis_id)
    .single()

  if (!analysis) {
    return NextResponse.json({ error: 'Analysis not found' }, { status: 404 })
  }

  // Idempotency guard: QStash may retry — skip if already terminal or in-flight
  if (
    TERMINAL_STATUSES.includes(analysis.status as AnalysisStatus) ||
    analysis.status === 'processing'
  ) {
    return NextResponse.json({ skipped: true, status: analysis.status })
  }

  const user_id = analysis.user_id!

  const { data: imageData, error: downloadError } = await supabase.storage
    .from('images')
    .download(analysis.image_url!)

  if (downloadError || !imageData) {
    await updateStatus('failed')
    return NextResponse.json({ error: 'Image download failed' }, { status: 500 })
  }

  const imageBuffer = Buffer.from(await imageData.arrayBuffer())
  const imageBase64 = imageBuffer.toString('base64')

  const { result: validation, usage: validateUsage } = await validateFace(imageBase64)

  if (!validation.face_detected || !validation.quality_pass) {
    await updateStatus('failed')
    return NextResponse.json({ error: 'Validation failed', issues: validation.issues })
  }

  try {
    await deductCredit(user_id, analysis_id, supabase)
  } catch {
    await updateStatus('failed')
    return NextResponse.json({ error: 'Credit deduction failed' }, { status: 500 })
  }

  await updateStatus('processing')

  let analyzeResult: { result: SkinAnalysisResult; usage: { input_tokens: number; output_tokens: number } }
  try {
    analyzeResult = await analyzeSkin(imageBase64, analysis.locale as Locale)
  } catch {
    try {
      analyzeResult = await analyzeSkin(imageBase64, analysis.locale as Locale)
    } catch {
      await refundCredit(user_id, analysis_id, supabase)
      await updateStatus('failed')
      return NextResponse.json({ error: 'Analysis failed after retry' }, { status: 500 })
    }
  }
  const analysisResult = analyzeResult.result
  const analyzeUsage = analyzeResult.usage

  const { data: prevAnalysisRow } = await supabase
    .from('analyses')
    .select('analysis_results(overall_score, hydration_level)')
    .eq('user_id', user_id)
    .eq('status', 'completed')
    .neq('id', analysis_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  type PrevResult = { overall_score: number | null; hydration_level: number | null }
  type PrevAnalysisRow = { analysis_results: PrevResult[] | PrevResult | null } | null
  const prevResult =
    ((prevAnalysisRow as unknown as PrevAnalysisRow)?.analysis_results as PrevResult[] | null)?.[0] ??
    null

  const comparisonData =
    prevResult?.overall_score != null
      ? {
          overall_score: analysisResult.overall_score - prevResult.overall_score,
          hydration_level: analysisResult.hydration_level - (prevResult.hydration_level ?? 0),
        }
      : null

  const { error: insertError } = await supabase.from('analysis_results').insert({
    analysis_id,
    skin_type: analysisResult.skin_type,
    concerns: analysisResult.concerns,
    hydration_level: analysisResult.hydration_level,
    overall_score: analysisResult.overall_score,
    diagnosis_text: analysisResult.diagnosis,
    recommendations: analysisResult.recommendations as unknown as Json,
    comparison_data: comparisonData as unknown as Json,
    feature_points: [] as unknown as Json,
    raw_response: analysisResult as unknown as Json,
  })

  if (insertError) {
    await refundCredit(user_id, analysis_id, supabase)
    await updateStatus('failed')
    return NextResponse.json({ error: 'Result save failed' }, { status: 500 })
  }

  const PRICE = {
    SONNET_IN:  3.0  / 1_000_000,
    SONNET_OUT: 15.0 / 1_000_000,
    HAIKU_IN:   0.8  / 1_000_000,
    HAIKU_OUT:  4.0  / 1_000_000,
  }
  const estimated_cost_usd =
    analyzeUsage.input_tokens  * PRICE.SONNET_IN  +
    analyzeUsage.output_tokens * PRICE.SONNET_OUT +
    validateUsage.input_tokens * PRICE.HAIKU_IN   +
    validateUsage.output_tokens * PRICE.HAIKU_OUT

  await supabase.from('analyses').update({
    status: 'completed',
    input_tokens: analyzeUsage.input_tokens,
    output_tokens: analyzeUsage.output_tokens,
    estimated_cost_usd,
  }).eq('id', analysis_id)
  return NextResponse.json({ success: true })
}
