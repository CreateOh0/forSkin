'use client'

import { useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { buttonVariants } from '@/components/ui/button'
import Link from 'next/link'

interface Props {
  error: Error & { digest?: string }
  reset: () => void
}

export default function Error({ error, reset }: Props) {
  const t = useTranslations('Error')

  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
      <div className="text-destructive text-5xl">⚠</div>
      <h2 className="text-xl font-semibold">{t('title')}</h2>
      <p className="text-muted-foreground max-w-xs">{t('description')}</p>
      <div className="flex gap-3">
        <button onClick={reset} className={buttonVariants()}>
          {t('retry')}
        </button>
        <Link href="/" className={buttonVariants({ variant: 'outline' })}>
          {t('goHome')}
        </Link>
      </div>
    </div>
  )
}
