import { useTranslations } from 'next-intl'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Json } from '@/lib/supabase/types'

interface Recommendation {
  category: string
  advice: string
  key_ingredients: string[]
}

interface Props {
  recommendations: Json
}

export function RecommendationList({ recommendations }: Props) {
  const t = useTranslations('Results')
  const items = (recommendations as unknown as Recommendation[]) ?? []

  if (items.length === 0) return null

  return (
    <div className="space-y-3 mb-8">
      <h2 className="text-base font-semibold">{t('recommendations')}</h2>
      {items.map((rec, idx) => (
        <Card key={idx}>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-medium">{rec.category}</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-2">
            <p className="text-sm text-muted-foreground">{rec.advice}</p>
            {rec.key_ingredients.length > 0 && (
              <div className="flex flex-wrap gap-1">
                <span className="text-xs text-muted-foreground mr-1">{t('keyIngredients')}:</span>
                {rec.key_ingredients.map((ing) => (
                  <Badge key={ing} variant="outline" className="text-xs">
                    {ing}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
