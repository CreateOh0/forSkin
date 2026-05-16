import { getRequestConfig } from 'next-intl/server'
import { hasLocale } from 'next-intl'

export const locales = ['ko', 'en', 'ja'] as const
export const defaultLocale = 'ko' as const

const messageImports = {
  ko: () => import('../../../messages/ko.json'),
  en: () => import('../../../messages/en.json'),
  ja: () => import('../../../messages/ja.json'),
}

export default getRequestConfig(async ({ requestLocale }) => {
  // Corresponds to the [locale] URL segment — takes priority over cookies
  const requested = await requestLocale
  const locale = hasLocale(locales, requested) ? requested : defaultLocale
  const messages = (await messageImports[locale]()).default
  return { locale, messages }
})
