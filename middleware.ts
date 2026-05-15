import createMiddleware from 'next-intl/middleware'
import { NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'
import { locales, defaultLocale } from '@/lib/i18n/request'

const intlMiddleware = createMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'always',
})

export async function middleware(request: NextRequest) {
  const response = intlMiddleware(request)
  return updateSession(request, response as NextResponse)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
}
