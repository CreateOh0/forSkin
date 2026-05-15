'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { signup, loginWithGoogle } from '@/actions/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import Link from 'next/link'

export function SignupForm({ locale }: { locale: string }) {
  const t = useTranslations('Auth')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const formData = new FormData(e.currentTarget)
    formData.set('locale', locale)
    const result = await signup(formData)
    if (result?.error) setError(result.error)
    setLoading(false)
  }

  return (
    <div className="w-full max-w-sm mx-auto space-y-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="name">{t('name')}</Label>
          <Input id="name" name="name" type="text" />
        </div>
        <div>
          <Label htmlFor="email">{t('email')}</Label>
          <Input id="email" name="email" type="email" required />
        </div>
        <div>
          <Label htmlFor="password">{t('password')}</Label>
          <Input id="password" name="password" type="password" required minLength={6} />
        </div>
        {error && <p className="text-destructive text-sm">{error}</p>}
        <Button type="submit" className="w-full" disabled={loading}>{t('signup')}</Button>
      </form>
      <Button variant="outline" className="w-full" onClick={() => loginWithGoogle(locale)}>
        {t('loginWithGoogle')}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        {t('hasAccount')} <Link href={`/${locale}/auth/login`} className="underline">{t('login')}</Link>
      </p>
    </div>
  )
}
