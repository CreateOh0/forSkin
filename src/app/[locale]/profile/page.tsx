import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { ProfileForm } from '@/components/profile/ProfileForm'

interface Props { params: Promise<{ locale: string }> }

export default async function ProfilePage({ params }: Props) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'Profile' })
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}/auth/login`)

  const { data: profile } = await supabase
    .from('users')
    .select('name, preferred_locale, avatar_url')
    .eq('id', user.id)
    .single()

  return (
    <main className="container max-w-lg mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-8">{t('title')}</h1>
      <ProfileForm
        locale={locale}
        profile={{
          name: profile?.name ?? null,
          preferred_locale: profile?.preferred_locale ?? 'ko',
          avatar_url: profile?.avatar_url ?? null,
        }}
      />
    </main>
  )
}
