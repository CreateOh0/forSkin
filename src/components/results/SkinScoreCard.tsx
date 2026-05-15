import { useTranslations } from 'next-intl'
import { Badge } from '@/components/ui/badge'
import type { Json } from '@/lib/supabase/types'

interface ComparisonData {
  overall_score?: number
  hydration_level?: number
}

interface Props {
  result: {
    skin_type: string | null
    overall_score: number | null
    hydration_level: number | null
    concerns: Json
    diagnosis_text: string | null
    comparison_data: Json | null
  }
}

function ScoreDelta({ value }: { value: number }) {
  if (value === 0) return null
  const positive = value > 0
  return (
    <span className={`text-sm font-medium ${positive ? 'text-green-500' : 'text-red-500'}`}>
      {positive ? '+' : ''}
      {value}
    </span>
  )
}

export function SkinScoreCard({ result }: Props) {
  const t = useTranslations('Results')
  const score = result.overall_score ?? 0
  const comparison = result.comparison_data as ComparisonData | null
  const concerns = (result.concerns as string[]) ?? []

  const scoreColor =
    score >= 70 ? 'text-green-500' : score >= 40 ? 'text-yellow-500' : 'text-red-500'

  return (
    <div className="space-y-6 mb-8">
      <div className="text-center p-6 bg-muted/30 rounded-xl">
        <p className="text-sm text-muted-foreground mb-1">{t('skinScore')}</p>
        <div className="flex items-center justify-center gap-2">
          <span className={`text-7xl font-bold tabular-nums ${scoreColor}`}>{score}</span>
          <span className="text-muted-foreground text-2xl">/100</span>
        </div>
        {comparison?.overall_score != null && (
          <div className="mt-1 flex items-center justify-center gap-1 text-sm text-muted-foreground">
            <span>{t('comparedToPrevious')}</span>
            <ScoreDelta value={comparison.overall_score} />
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 bg-muted/30 rounded-xl text-center">
          <p className="text-xs text-muted-foreground mb-1">{t('skinType')}</p>
          <p className="font-semibold">{result.skin_type ?? '—'}</p>
        </div>
        <div className="p-4 bg-muted/30 rounded-xl text-center">
          <p className="text-xs text-muted-foreground mb-1">{t('hydrationLevel')}</p>
          <div className="flex items-center justify-center gap-1">
            <span className="font-semibold">{result.hydration_level ?? '—'}</span>
            <span className="text-muted-foreground text-xs">/10</span>
          </div>
          {comparison?.hydration_level != null && (
            <ScoreDelta value={comparison.hydration_level} />
          )}
        </div>
      </div>

      {concerns.length > 0 && (
        <div>
          <p className="text-sm font-medium mb-2">{t('concerns')}</p>
          <div className="flex flex-wrap gap-2">
            {concerns.map((concern) => (
              <Badge key={concern} variant="secondary">
                {concern}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {result.diagnosis_text && (
        <div>
          <p className="text-sm font-medium mb-2">{t('diagnosis')}</p>
          <p className="text-sm text-muted-foreground leading-relaxed">{result.diagnosis_text}</p>
        </div>
      )}
    </div>
  )
}
