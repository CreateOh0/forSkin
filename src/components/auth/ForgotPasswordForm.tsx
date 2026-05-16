'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { requestPasswordReset } from '@/actions/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import Link from 'next/link'

export function ForgotPasswordForm({ locale }: { locale: string }) {
  const t = useTranslations('ForgotPassword')
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const formData = new FormData(e.currentTarget)
    formData.set('locale', locale)
    const result = await requestPasswordReset(formData)
    if (result?.error) setError(result.error)
    else setSent(true)
    setLoading(false)
  }

  if (sent) {
    return (
      <div className="w-full max-w-sm mx-auto text-center space-y-4">
        <p className="font-semibold">{t('sent')}</p>
        <p className="text-sm text-muted-foreground">{t('sentDescription')}</p>
        <Link href={`/${locale}/auth/login`} className="underline text-sm">{t('backToLogin')}</Link>
      </div>
    )
  }

  return (
    <div className="w-full max-w-sm mx-auto space-y-6">
      <p className="text-sm text-muted-foreground">{t('description')}</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="email">{t('email')}</Label>
          <Input id="email" name="email" type="email" required />
        </div>
        {error && <p className="text-destructive text-sm">{error}</p>}
        <Button type="submit" className="w-full" disabled={loading}>{t('send')}</Button>
      </form>
      <p className="text-center text-sm">
        <Link href={`/${locale}/auth/login`} className="underline text-muted-foreground">{t('backToLogin')}</Link>
      </p>
    </div>
  )
}
