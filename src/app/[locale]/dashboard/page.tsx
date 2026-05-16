import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { getTopIngredients } from '@/actions/dashboard'
import { SummaryCards } from '@/components/dashboard/SummaryCards'
import { ScoreChart } from '@/components/dashboard/ScoreChart'
import { AnalysisHistoryList } from '@/components/dashboard/AnalysisHistoryList'
import { Badge } from '@/components/ui/badge'

interface Props { params: Promise<{ locale: string }> }

export default async function DashboardPage({ params }: Props) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'Dashboard' })
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}/auth/login`)

  // Fetch all analyses with results
  const { data: rawAnalyses } = await supabase
    .from('analyses')
    .select('id, created_at, thumbnail_url, status, analysis_results(overall_score, concerns, recommendations)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  // Fetch which analyses have ratings already
  const { data: ratedAnalyses } = await supabase
    .from('recommendation_ratings')
    .select('analysis_id')
    .eq('user_id', user.id)

  const ratedIds = new Set((ratedAnalyses ?? []).map(r => r.analysis_id))

  type RawAnalysis = {
    id: string
    created_at: string
    thumbnail_url: string | null
    status: string
    analysis_results: Array<{
      overall_score: number | null
      concerns: unknown
      recommendations: unknown
    }>
  }

  const analyses = (rawAnalyses as unknown as RawAnalysis[] ?? []).map(a => ({
    id: a.id,
    created_at: a.created_at,
    thumbnail_url: a.thumbnail_url,
    status: a.status,
    analysis_results: a.analysis_results ?? [],
    hasRating: ratedIds.has(a.id),
    categories: (a.analysis_results?.[0]?.recommendations as Array<{ category: string }> ?? [])
      .map(r => r.category),
  }))

  const completedAnalyses = analyses.filter(a => a.status === 'completed')

  // Compute summary stats
  const totalAnalyses = analyses.length
  const latestScore = completedAnalyses[0]?.analysis_results[0]?.overall_score ?? null
  const allConcerns = completedAnalyses.flatMap(a =>
    Array.isArray(a.analysis_results[0]?.concerns) ? a.analysis_results[0].concerns as string[] : []
  )
  const concernCounts: Record<string, number> = {}
  for (const c of allConcerns) concernCounts[c] = (concernCounts[c] ?? 0) + 1
  const topConcern = Object.entries(concernCounts).sort(([, a], [, b]) => b - a)[0]?.[0] ?? null

  const chartData = completedAnalyses
    .filter(a => a.analysis_results[0]?.overall_score != null)
    .map(a => ({
      date: a.created_at,
      score: a.analysis_results[0].overall_score as number,
    }))
    .reverse()

  const topIngredients = await getTopIngredients(user.id)

  return (
    <main className="container mx-auto px-4 py-8 max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">{t('title')}</h1>

      <SummaryCards
        totalAnalyses={totalAnalyses}
        latestScore={latestScore}
        topConcern={topConcern}
      />

      <ScoreChart data={chartData} />

      {topIngredients.length > 0 && (
        <div className="mb-8">
          <h2 className="text-base font-semibold mb-3">{t('effectiveIngredients')}</h2>
          <div className="flex flex-wrap gap-2">
            {topIngredients.map(({ ingredient }) => (
              <Badge key={ingredient} variant="secondary">{ingredient}</Badge>
            ))}
          </div>
        </div>
      )}

      <h2 className="text-base font-semibold mb-3">{t('analysisHistory')}</h2>
      <AnalysisHistoryList analyses={analyses} locale={locale} />
    </main>
  )
}
