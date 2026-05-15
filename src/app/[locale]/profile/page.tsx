import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { updateProfile } from '@/actions/profile'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface Props { params: Promise<{ locale: string }> }

export default async function ProfilePage({ params }: Props) {
  const { locale } = await params
  const t = await getTranslations('Profile')
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}/auth/login`)

  const { data: profile } = await supabase.from('users').select('*').eq('id', user.id).single()

  return (
    <main className="container max-w-lg mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-8">{t('title')}</h1>
      <form action={updateProfile} className="space-y-4">
        <div>
          <Label htmlFor="preferred_locale">{t('preferredLocale')}</Label>
          <select name="preferred_locale" defaultValue={profile?.preferred_locale ?? 'ko'}
            className="w-full border rounded px-3 py-2 mt-1">
            <option value="ko">한국어</option>
            <option value="en">English</option>
            <option value="ja">日本語</option>
          </select>
        </div>
        <div>
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" defaultValue={profile?.name ?? ''} />
        </div>
        <Button type="submit">{t('save')}</Button>
      </form>
    </main>
  )
}
