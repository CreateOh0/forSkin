'use client'

import { useState, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

type DataPoint = { date: string; score: number }
type Period = '7d' | '30d' | '90d' | 'all'

interface Props {
  data: DataPoint[]
}

const PERIODS: { key: Period; labelKey: string; days: number }[] = [
  { key: '7d', labelKey: 'periodWeek', days: 7 },
  { key: '30d', labelKey: 'periodMonth', days: 30 },
  { key: '90d', labelKey: 'periodThreeMonths', days: 90 },
  { key: 'all', labelKey: 'periodAll', days: Infinity },
]

const W = 400
const H = 120
const PAD = 16

export function ScoreChart({ data }: Props) {
  const t = useTranslations('Dashboard')
  const [period, setPeriod] = useState<Period>('all')

  const filtered = useMemo(() => {
    const periodDef = PERIODS.find(p => p.key === period)!
    if (periodDef.days === Infinity) return data
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - periodDef.days)
    return data.filter(d => new Date(d.date) >= cutoff)
  }, [data, period])

  const points = useMemo(() => {
    if (filtered.length < 2) return null
    const minScore = Math.min(...filtered.map(d => d.score))
    const maxScore = Math.max(...filtered.map(d => d.score))
    const scoreRange = maxScore - minScore || 1

    return filtered.map((d, i) => {
      const x = PAD + (i / (filtered.length - 1)) * (W - PAD * 2)
      const y = H - PAD - ((d.score - minScore) / scoreRange) * (H - PAD * 2)
      return { x, y, score: d.score, date: d.date }
    })
  }, [filtered])

  if (data.length === 0) {
    return (
      <Card className="mb-8">
        <CardHeader><CardTitle className="text-base">{t('scoreHistory')}</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">{t('noAnalyses')}</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="mb-8">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base">{t('scoreHistory')}</CardTitle>
        <div className="flex gap-1">
          {PERIODS.map(p => (
            <Button
              key={p.key}
              variant={period === p.key ? 'default' : 'ghost'}
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setPeriod(p.key)}
            >
              {t(p.labelKey)}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {!points ? (
          <p className="text-sm text-muted-foreground text-center py-4">{t('noAnalyses')}</p>
        ) : (
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 120 }}>
            <polyline
              points={points.map(p => `${p.x},${p.y}`).join(' ')}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-primary"
            />
            {points.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r={3} fill="currentColor" className="text-primary">
                <title>{p.score} ({p.date.slice(0, 10)})</title>
              </circle>
            ))}
            <text x={PAD} y={H - 4} fontSize={10} className="fill-muted-foreground">
              {points[0]?.date.slice(5, 10)}
            </text>
            <text x={W - PAD} y={H - 4} fontSize={10} textAnchor="end" className="fill-muted-foreground">
              {points[points.length - 1]?.date.slice(5, 10)}
            </text>
          </svg>
        )}
      </CardContent>
    </Card>
  )
}
