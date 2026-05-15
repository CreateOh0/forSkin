import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getTranslations } from 'next-intl/server'
import { LocaleSwitcher } from './LocaleSwitcher'
import { logout } from '@/actions/auth'
import { Button } from '@/components/ui/button'

interface Props { locale: string }

export async function Header({ locale }: Props) {
  const t = await getTranslations('Nav')
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let creditBalance = 0
  if (user) {
    const { data } = await supabase.from('credits').select('balance').eq('user_id', user.id).single()
    creditBalance = data?.balance ?? 0
  }

  return (
    <header className="border-b">
      <div className="container mx-auto px-4 h-14 flex items-center justify-between">
        <Link href={`/${locale}`} className="font-bold text-lg">forSkin</Link>
        <nav className="flex items-center gap-3">
          {user ? (
            <>
              <Link href={`/${locale}/analyze`} className="text-sm hover:underline">{t('analyze')}</Link>
              <Link href={`/${locale}/dashboard`} className="text-sm hover:underline">{t('dashboard')}</Link>
              <span className="text-sm text-muted-foreground">{creditBalance} {t('credits')}</span>
              <Link href={`/${locale}/profile`} className="text-sm hover:underline">{t('profile')}</Link>
              <form action={logout}>
                <Button variant="ghost" size="sm" type="submit">{t('logout')}</Button>
              </form>
            </>
          ) : (
            <>
              <Link href={`/${locale}/auth/login`}>
                <Button variant="ghost" size="sm">{t('login')}</Button>
              </Link>
              <Link href={`/${locale}/auth/signup`}>
                <Button size="sm">{t('signup')}</Button>
              </Link>
            </>
          )}
          <LocaleSwitcher currentLocale={locale} />
        </nav>
      </div>
    </header>
  )
}
