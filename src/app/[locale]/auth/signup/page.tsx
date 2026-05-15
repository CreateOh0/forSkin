import { getTranslations } from 'next-intl/server'
import { SignupForm } from '@/components/auth/SignupForm'

interface Props { params: Promise<{ locale: string }> }

export default async function SignupPage({ params }: Props) {
  const { locale } = await params
  const t = await getTranslations('Auth')
  return (
    <main className="container mx-auto px-4 py-16">
      <h1 className="text-2xl font-bold text-center mb-8">{t('signup')}</h1>
      <SignupForm locale={locale} />
    </main>
  )
}
