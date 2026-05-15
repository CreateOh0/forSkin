import { getTranslations } from 'next-intl/server'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

interface Props { params: Promise<{ locale: string }> }

export default async function LandingPage({ params }: Props) {
  const { locale } = await params
  const t = await getTranslations('Landing')

  return (
    <main className="container mx-auto px-4 py-24 text-center">
      <h1 className="text-5xl font-bold mb-4">{t('title')}</h1>
      <p className="text-xl text-muted-foreground mb-8">{t('subtitle')}</p>
      <Link href={`/${locale}/auth/signup`}>
        <Button size="lg">{t('cta')}</Button>
      </Link>
    </main>
  )
}
