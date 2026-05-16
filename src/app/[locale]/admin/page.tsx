import { getTranslations } from 'next-intl/server'
import { getAdminOverview } from '@/actions/admin'
import { OverviewCards } from '@/components/admin/OverviewCards'

interface Props { params: Promise<{ locale: string }> }

export default async function AdminOverviewPage({ params }: Props) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'Admin' })
  const data = await getAdminOverview()

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">{t('overview')}</h1>
      <OverviewCards data={data} locale={locale} />
    </div>
  )
}
