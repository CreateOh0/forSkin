import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getTranslations } from 'next-intl/server'
import type { OverviewData } from '@/actions/admin'

interface Props {
  data: OverviewData & { error?: string }
  locale: string
}

export async function OverviewCards({ data, locale }: Props) {
  const t = await getTranslations({ locale, namespace: 'Admin' })

  const cards = [
    { label: t('todayAnalyses'), value: data.todayAnalyses.toString() },
    { label: t('todayCost'),     value: `$${data.todayCost.toFixed(4)}` },
    { label: t('newUsers'),      value: data.newUsers.toString() },
  ]

  return (
    <div className="grid grid-cols-3 gap-4 mb-8">
      {cards.map(card => (
        <Card key={card.label}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {card.label}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{card.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
