import { getTranslations } from 'next-intl/server'
import { ResetPasswordForm } from '@/components/auth/ResetPasswordForm'

interface Props { params: Promise<{ locale: string }> }

export default async function ResetPasswordPage({ params }: Props) {
  const { locale } = await params
  const t = await getTranslations('ForgotPassword')
  return (
    <main className="container mx-auto px-4 py-16">
      <h1 className="text-2xl font-bold text-center mb-8">{t('resetTitle')}</h1>
      <ResetPasswordForm locale={locale} />
    </main>
  )
}
