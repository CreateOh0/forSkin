'use client'

import { useTranslations } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { CostDataPoint } from '@/actions/admin'

interface Props {
  data: CostDataPoint[]
}

export function CostSummaryTable({ data }: Props) {
  const t = useTranslations('Admin')

  const totals = data.reduce(
    (acc, d) => ({
      calls: acc.calls + d.call_count,
      input: acc.input + d.input_tokens,
      output: acc.output + d.output_tokens,
      cost: acc.cost + d.estimated_cost_usd,
    }),
    { calls: 0, input: 0, output: 0, cost: 0 }
  )

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="text-base">Summary</CardTitle>
      </CardHeader>
      <CardContent>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2">Date</th>
              <th className="text-right py-2">{t('callCount')}</th>
              <th className="text-right py-2">{t('inputTokens')}</th>
              <th className="text-right py-2">{t('outputTokens')}</th>
              <th className="text-right py-2">{t('estimatedCost')}</th>
            </tr>
          </thead>
          <tbody>
            {data.map(row => (
              <tr key={row.date} className="border-b hover:bg-muted/50">
                <td className="py-2">{row.date}</td>
                <td className="py-2 text-right font-mono">{row.call_count}</td>
                <td className="py-2 text-right font-mono">{row.input_tokens.toLocaleString()}</td>
                <td className="py-2 text-right font-mono">{row.output_tokens.toLocaleString()}</td>
                <td className="py-2 text-right font-mono">${row.estimated_cost_usd.toFixed(4)}</td>
              </tr>
            ))}
            <tr className="font-semibold bg-muted/30">
              <td className="py-2">Total</td>
              <td className="py-2 text-right font-mono">{totals.calls}</td>
              <td className="py-2 text-right font-mono">{totals.input.toLocaleString()}</td>
              <td className="py-2 text-right font-mono">{totals.output.toLocaleString()}</td>
              <td className="py-2 text-right font-mono">${totals.cost.toFixed(4)}</td>
            </tr>
          </tbody>
        </table>
      </CardContent>
    </Card>
  )
}
