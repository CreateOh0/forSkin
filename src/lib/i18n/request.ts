import { getRequestConfig } from 'next-intl/server'
import { cookies } from 'next/headers'

export const locales = ['ko', 'en', 'ja'] as const
export const defaultLocale = 'ko' as const

const messageImports = {
  ko: () => import('../../../messages/ko.json'),
  en: () => import('../../../messages/en.json'),
  ja: () => import('../../../messages/ja.json'),
}

export default getRequestConfig(async () => {
  const cookieStore = await cookies()
  const locale = (cookieStore.get('locale')?.value ?? defaultLocale) as 'ko' | 'en' | 'ja'
  const messages = (await messageImports[locale]()).default
  return { locale, messages }
})
