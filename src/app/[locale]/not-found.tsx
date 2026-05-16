import { getTranslations } from 'next-intl/server'
import { buttonVariants } from '@/components/ui/button'
import Link from 'next/link'

export default async function NotFound() {
  const t = await getTranslations('NotFound')

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
      <div className="text-muted-foreground text-6xl font-bold">404</div>
      <h2 className="text-xl font-semibold">{t('title')}</h2>
      <p className="text-muted-foreground max-w-xs">{t('description')}</p>
      <Link href="/" className={buttonVariants()}>
        {t('goHome')}
      </Link>
    </div>
  )
}
