import createMiddleware from 'next-intl/middleware'
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { updateSession } from '@/lib/supabase/middleware'
import { locales, defaultLocale } from '@/lib/i18n/request'

const intlMiddleware = createMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'always',
})

export async function middleware(request: NextRequest) {
  // /[locale]/admin/** — redirect unauthenticated users to login
  const pathname = request.nextUrl.pathname
  if (/^\/[a-z]{2}\/admin(\/|$)/.test(pathname)) {
    const locale = pathname.split('/')[1] ?? defaultLocale

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => request.cookies.getAll(),
          setAll: () => {},
        },
      }
    )
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.redirect(
        new URL(`/${locale}/auth/login`, request.url)
      )
    }
  }

  const response = intlMiddleware(request)
  return updateSession(request, response as NextResponse)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
}
