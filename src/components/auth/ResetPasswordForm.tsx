'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { updatePassword } from '@/actions/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function ResetPasswordForm({ locale }: { locale: string }) {
  const t = useTranslations('ForgotPassword')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const formData = new FormData(e.currentTarget)
    const password = formData.get('password') as string
    const confirm = formData.get('confirm') as string
    if (password !== confirm) {
      setError(t('passwordMismatch'))
      setLoading(false)
      return
    }
    formData.set('locale', locale)
    const result = await updatePassword(formData)
    if (result?.error) setError(result.error)
    setLoading(false)
  }

  return (
    <div className="w-full max-w-sm mx-auto space-y-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="password">{t('newPassword')}</Label>
          <Input id="password" name="password" type="password" required minLength={6} />
        </div>
        <div>
          <Label htmlFor="confirm">{t('confirmPassword')}</Label>
          <Input id="confirm" name="confirm" type="password" required minLength={6} />
        </div>
        {error && <p className="text-destructive text-sm">{error}</p>}
        <Button type="submit" className="w-full" disabled={loading}>{t('update')}</Button>
      </form>
    </div>
  )
}
