'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import Image from 'next/image'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { deleteAnalysis } from '@/actions/dashboard'
import { RatingModal } from './RatingModal'

type AnalysisRow = {
  id: string
  created_at: string
  thumbnail_url: string | null
  status: string
  analysis_results: Array<{
    overall_score: number | null
    concerns: unknown
  }>
  hasRating: boolean
  categories?: string[]
}

interface Props {
  analyses: AnalysisRow[]
  locale: string
}

export function AnalysisHistoryList({ analyses, locale }: Props) {
  const t = useTranslations('Dashboard')
  const [ratingTarget, setRatingTarget] = useState<{ id: string; categories: string[] } | null>(null)

  if (analyses.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground mb-4">{t('noAnalyses')}</p>
        <Link href={`/${locale}/analyze`}>
          <Button>{t('startAnalysis')}</Button>
        </Link>
      </div>
    )
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm(t('deleteConfirm'))) return
    const formData = new FormData()
    formData.set('analysisId', id)
    await deleteAnalysis(formData)
  }

  return (
    <>
      <ul className="space-y-3">
        {analyses.map(analysis => {
          const result = analysis.analysis_results[0]
          const concerns = Array.isArray(result?.concerns) ? (result.concerns as string[]) : []
          const date = new Date(analysis.created_at).toLocaleDateString(locale)

          return (
            <li key={analysis.id} className="border rounded-lg p-4 flex gap-4 items-start">
              {analysis.thumbnail_url ? (
                <div className="relative w-16 h-16 shrink-0 rounded overflow-hidden">
                  <Image src={analysis.thumbnail_url} alt="" fill className="object-cover" />
                </div>
              ) : (
                <div className="w-16 h-16 shrink-0 rounded bg-muted" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-muted-foreground">{date}</span>
                  {result?.overall_score != null && (
                    <Link href={`/${locale}/results/${analysis.id}`}>
                      <span className="text-2xl font-bold text-primary">{result.overall_score}</span>
                    </Link>
                  )}
                </div>
                <div className="flex flex-wrap gap-1 mb-2">
                  {concerns.slice(0, 3).map(c => (
                    <Badge key={c} variant="secondary" className="text-xs">{c}</Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  {analysis.status === 'completed' && !analysis.hasRating && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setRatingTarget({ id: analysis.id, categories: analysis.categories ?? [] })}
                    >
                      {t('rateRecommendation')}
                    </Button>
                  )}
                  {analysis.status === 'completed' && analysis.hasRating && (
                    <span className="text-xs text-muted-foreground self-center">{t('ratedLabel')}</span>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => handleDelete(analysis.id)}
                  >
                    {t('deleteAnalysis')}
                  </Button>
                </div>
              </div>
            </li>
          )
        })}
      </ul>
      {ratingTarget && (
        <RatingModal
          analysisId={ratingTarget.id}
          categories={ratingTarget.categories}
          onClose={() => setRatingTarget(null)}
        />
      )}
    </>
  )
}
