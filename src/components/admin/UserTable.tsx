'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { CreditAdjustModal } from './CreditAdjustModal'
import { SuspendConfirmDialog } from './SuspendConfirmDialog'
import type { AdminUser } from '@/actions/admin'

interface Props {
  users: AdminUser[]
  total: number
  locale: string
}

export function UserTable({ users, total, locale }: Props) {
  const t = useTranslations('Admin')
  const router = useRouter()
  const searchParams = useSearchParams()
  const [search, setSearch] = useState(searchParams.get('search') ?? '')
  const [creditTarget, setCreditTarget] = useState<AdminUser | null>(null)
  const [suspendTarget, setSuspendTarget] = useState<AdminUser | null>(null)

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const params = new URLSearchParams(searchParams)
    if (search) params.set('search', search)
    else params.delete('search')
    params.delete('page')
    router.push(`?${params.toString()}`)
  }

  const page = parseInt(searchParams.get('page') ?? '0', 10)

  const handlePage = (next: number) => {
    const params = new URLSearchParams(searchParams)
    params.set('page', next.toString())
    router.push(`?${params.toString()}`)
  }

  if (users.length === 0 && !search) {
    return <p className="text-muted-foreground">{t('noData')}</p>
  }

  return (
    <div>
      <form onSubmit={handleSearch} className="flex gap-2 mb-4">
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={t('searchPlaceholder')}
          className="max-w-xs"
        />
        <Button type="submit" variant="outline">{t('search')}</Button>
      </form>

      {users.length === 0 ? (
        <p className="text-muted-foreground">{t('noData')}</p>
      ) : (
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2 pr-4">Email</th>
              <th className="text-left py-2 pr-4">Name</th>
              <th className="text-right py-2 pr-4">{t('balance')}</th>
              <th className="text-left py-2 pr-4">{t('status')}</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody>
            {users.map(user => {
              const isBanned = !!user.banned_until
              return (
                <tr key={user.id} className="border-b hover:bg-muted/50">
                  <td className="py-2 pr-4">{user.email}</td>
                  <td className="py-2 pr-4">{user.name ?? '—'}</td>
                  <td className="py-2 pr-4 text-right font-mono">{user.balance}</td>
                  <td className="py-2 pr-4">
                    <Badge variant={isBanned ? 'destructive' : 'secondary'}>
                      {isBanned ? t('suspended') : t('active')}
                    </Badge>
                  </td>
                  <td className="py-2 flex gap-2 justify-end">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setCreditTarget(user)}
                    >
                      {t('adjust')}
                    </Button>
                    <Button
                      size="sm"
                      variant={isBanned ? 'default' : 'destructive'}
                      onClick={() => setSuspendTarget(user)}
                    >
                      {isBanned ? t('unsuspend') : t('suspend')}
                    </Button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}

      <div className="flex justify-between items-center mt-4">
        <p className="text-sm text-muted-foreground">Total: {total}</p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" disabled={page === 0} onClick={() => handlePage(page - 1)}>
            Prev
          </Button>
          <Button size="sm" variant="outline" disabled={(page + 1) * 10 >= total} onClick={() => handlePage(page + 1)}>
            Next
          </Button>
        </div>
      </div>

      {creditTarget && (
        <CreditAdjustModal
          userId={creditTarget.id}
          userName={creditTarget.name}
          open
          onClose={() => setCreditTarget(null)}
        />
      )}
      {suspendTarget && (
        <SuspendConfirmDialog
          userId={suspendTarget.id}
          banned={!!suspendTarget.banned_until}
          open
          onClose={() => setSuspendTarget(null)}
        />
      )}
    </div>
  )
}
