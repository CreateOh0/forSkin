import { getTranslations } from 'next-intl/server'
import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm'

interface Props { params: Promise<{ locale: string }> }

export default async function ForgotPasswordPage({ params }: Props) {
  const { locale } = await params
  const t = await getTranslations('ForgotPassword')
  return (
    <main className="container mx-auto px-4 py-16">
      <h1 className="text-2xl font-bold text-center mb-8">{t('title')}</h1>
      <ForgotPasswordForm locale={locale} />
    </main>
  )
}
