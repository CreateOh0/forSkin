import { getTranslations } from 'next-intl/server'
import { LoginForm } from '@/components/auth/LoginForm'

interface Props { params: Promise<{ locale: string }> }

export default async function LoginPage({ params }: Props) {
  const { locale } = await params
  const t = await getTranslations('Auth')
  return (
    <main className="container mx-auto px-4 py-16">
      <h1 className="text-2xl font-bold text-center mb-8">{t('login')}</h1>
      <LoginForm locale={locale} />
    </main>
  )
}
