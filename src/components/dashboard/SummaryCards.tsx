'use client'

import { useTranslations } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface Props {
  totalAnalyses: number
  latestScore: number | null
  topConcern: string | null
}

export function SummaryCards({ totalAnalyses, latestScore, topConcern }: Props) {
  const t = useTranslations('Dashboard')

  return (
    <div className="grid grid-cols-3 gap-4 mb-8">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">{t('totalAnalyses')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold">{totalAnalyses}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">{t('latestScore')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold">{latestScore ?? '—'}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">{t('topConcern')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-lg font-semibold truncate">{topConcern ?? '—'}</p>
        </CardContent>
      </Card>
    </div>
  )
}
