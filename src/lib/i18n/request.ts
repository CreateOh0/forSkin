import { getRequestConfig } from 'next-intl/server'
import { cookies } from 'next/headers'

export const locales = ['ko', 'en', 'ja'] as const
export const defaultLocale = 'ko' as const

export default getRequestConfig(async () => {
  const cookieStore = await cookies()
  const locale = (cookieStore.get('locale')?.value ?? defaultLocale) as 'ko' | 'en' | 'ja'
  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  }
})
