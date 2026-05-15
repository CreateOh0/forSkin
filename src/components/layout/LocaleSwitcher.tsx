'use client'

import { useRouter } from 'next/navigation'
import { usePathname } from 'next/navigation'

const LOCALES = [
  { code: 'ko', label: '한국어' },
  { code: 'en', label: 'English' },
  { code: 'ja', label: '日本語' },
]

export function LocaleSwitcher({ currentLocale }: { currentLocale: string }) {
  const router = useRouter()
  const pathname = usePathname()

  const handleChange = (locale: string) => {
    const newPath = pathname.replace(/^\/(ko|en|ja)/, `/${locale}`)
    document.cookie = `locale=${locale}; path=/; max-age=31536000`
    router.push(newPath)
  }

  return (
    <select
      value={currentLocale}
      onChange={(e) => handleChange(e.target.value)}
      className="text-sm bg-transparent border rounded px-2 py-1"
    >
      {LOCALES.map(({ code, label }) => (
        <option key={code} value={code}>{label}</option>
      ))}
    </select>
  )
}
