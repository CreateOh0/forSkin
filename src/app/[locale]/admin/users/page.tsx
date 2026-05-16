import { getTranslations } from 'next-intl/server'
import { getUsers } from '@/actions/admin'
import { UserTable } from '@/components/admin/UserTable'

interface Props {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ search?: string; page?: string }>
}

export default async function AdminUsersPage({ params, searchParams }: Props) {
  const { locale } = await params
  const { search, page } = await searchParams
  const t = await getTranslations({ locale, namespace: 'Admin' })

  const { users, total } = await getUsers(search, page ? parseInt(page, 10) : 0)

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">{t('users')}</h1>
      <UserTable users={users} total={total} locale={locale} />
    </div>
  )
}
