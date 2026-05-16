import { getTranslations } from 'next-intl/server'
import { getCostData } from '@/actions/admin'
import { CostChart } from '@/components/admin/CostChart'
import { CostSummaryTable } from '@/components/admin/CostSummaryTable'

interface Props {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ period?: string }>
}

export default async function AdminCostsPage({ params, searchParams }: Props) {
  const { locale } = await params
  const { period } = await searchParams
  const t = await getTranslations({ locale, namespace: 'Admin' })

  const validPeriod = period === 'day' ? 'day' : 'week'
  const data = await getCostData(validPeriod)

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">{t('costs')}</h1>
      <CostChart data={data} />
      <CostSummaryTable data={data} />
    </div>
  )
}
