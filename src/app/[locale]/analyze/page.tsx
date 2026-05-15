import { getTranslations } from 'next-intl/server'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AnalyzeForm } from '@/components/analyze/AnalyzeForm'

interface Props {
  params: Promise<{ locale: string }>
}

export default async function AnalyzePage({ params }: Props) {
  const { locale } = await params
  const t = await getTranslations('Analyze')
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}/auth/login`)

  const { data: credits } = await supabase
    .from('credits')
    .select('balance')
    .eq('user_id', user.id)
    .single()

  const creditBalance = (credits as { balance: number } | null)?.balance ?? 0

  return (
    <main className="container max-w-lg mx-auto py-8 px-4">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold mb-2">{t('title')}</h1>
        <p className="text-muted-foreground">{t('subtitle')}</p>
        <p className="text-sm text-muted-foreground mt-1">{t('creditInfo')}</p>
      </div>

      <div className="bg-muted/30 rounded-xl p-4 mb-6 text-sm space-y-1">
        <p>✓ {t('guide1')}</p>
        <p>✓ {t('guide2')}</p>
        <p>✓ {t('guide3')}</p>
      </div>

      <AnalyzeForm locale={locale} creditBalance={creditBalance} />
    </main>
  )
}
