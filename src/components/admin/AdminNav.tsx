'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'

interface Props { locale: string }

export function AdminNav({ locale }: Props) {
  const t = useTranslations('Admin')
  const pathname = usePathname()

  const links = [
    { href: `/${locale}/admin`,        label: t('overview') },
    { href: `/${locale}/admin/users`,  label: t('users') },
    { href: `/${locale}/admin/costs`,  label: t('costs') },
  ]

  return (
    <nav className="w-48 bg-muted border-r p-4 flex flex-col gap-1">
      <p className="text-xs font-semibold text-muted-foreground uppercase mb-3">Admin</p>
      {links.map(link => (
        <Link
          key={link.href}
          href={link.href}
          className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
            pathname === link.href
              ? 'bg-primary text-primary-foreground'
              : 'hover:bg-accent'
          }`}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  )
}
