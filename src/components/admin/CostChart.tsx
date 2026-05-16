'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { CostDataPoint } from '@/actions/admin'

const W = 400
const H = 120
const PAD = 16

interface Props {
  data: CostDataPoint[]
}

export function CostChart({ data }: Props) {
  const t = useTranslations('Admin')
  const router = useRouter()
  const searchParams = useSearchParams()
  const period = (searchParams.get('period') ?? 'week') as 'day' | 'week'

  const handlePeriod = (p: 'day' | 'week') => {
    const params = new URLSearchParams(searchParams)
    params.set('period', p)
    router.push(`?${params.toString()}`)
  }

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('estimatedCost')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">{t('noData')}</p>
        </CardContent>
      </Card>
    )
  }

  const costs = data.map(d => d.estimated_cost_usd)
  const minCost = Math.min(...costs)
  const maxCost = Math.max(...costs)
  const range = maxCost - minCost || 1

  const points = data.map((d, i) => {
    const x = PAD + (i / Math.max(data.length - 1, 1)) * (W - PAD * 2)
    const y = H - PAD - ((d.estimated_cost_usd - minCost) / range) * (H - PAD * 2)
    return { x, y, ...d }
  })

  const polyline = points.map(p => `${p.x},${p.y}`).join(' ')

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base">{t('estimatedCost')}</CardTitle>
        <div className="flex gap-1">
          {(['day', 'week'] as const).map(p => (
            <Button
              key={p}
              variant={period === p ? 'default' : 'ghost'}
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => handlePeriod(p)}
            >
              {p === 'day' ? t('periodDay') : t('periodWeek')}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
          <polyline
            points={polyline}
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth="2"
          />
          {points.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r="3" fill="hsl(var(--primary))" />
          ))}
        </svg>
      </CardContent>
    </Card>
  )
}
