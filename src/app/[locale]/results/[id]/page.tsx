export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AnalysisStatus } from '@/components/results/AnalysisStatus'
import { SkinScoreCard } from '@/components/results/SkinScoreCard'
import { RecommendationList } from '@/components/results/RecommendationList'
import { MedicalDisclaimer } from '@/components/results/MedicalDisclaimer'
import { getTranslations } from 'next-intl/server'

interface Props {
  params: Promise<{ locale: string; id: string }>
}

export default async function ResultsPage({ params }: Props) {
  const { locale, id } = await params
  const t = await getTranslations({ locale, namespace: 'Results' })
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: analysisRaw } = await supabase
    .from('analyses')
    .select('*, analysis_results(*)')
    .eq('id', id)
    .single()

  const analysis = analysisRaw as {
    id: string
    user_id: string
    status: string
    locale: string
    analysis_results: unknown
  } | null

  if (!analysis || analysis.user_id !== user?.id) notFound()

  type Json = import('@/lib/supabase/types').Json
  const result = (analysis.analysis_results as unknown[])?.[0] as
    | {
        skin_type: string | null
        overall_score: number | null
        hydration_level: number | null
        concerns: Json
        diagnosis_text: string | null
        comparison_data: Json
        recommendations: Json
      }
    | undefined

  const isComplete = analysis.status === 'completed' && result != null

  return (
    <main className="container max-w-lg mx-auto py-8 px-4">
      {!isComplete ? (
        <AnalysisStatus analysisId={id} locale={locale} />
      ) : (
        <>
          <h1 className="text-xl font-bold text-center mb-6">{t('title')}</h1>
          <SkinScoreCard result={result} />
          <RecommendationList recommendations={result.recommendations} />
          <MedicalDisclaimer locale={locale} />
        </>
      )}
    </main>
  )
}
