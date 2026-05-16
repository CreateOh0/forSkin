'use client'

import { useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useAnalysisStatus } from '@/hooks/useAnalysisStatus'
import { Loader2 } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import Link from 'next/link'

interface Props {
  analysisId: string
  locale: string
}

export function AnalysisStatus({ analysisId, locale }: Props) {
  const t = useTranslations('Results')
  const router = useRouter()
  const { status } = useAnalysisStatus(analysisId)
  const navigatingRef = useRef(false)

  useEffect(() => {
    if (status !== 'completed') return
    if (navigatingRef.current) return
    navigatingRef.current = true

    // Same-URL navigation does not re-run the RSC tree; refresh loads new server output.
    router.refresh()

    const fallback = window.setTimeout(() => {
      window.location.reload()
    }, 3000)

    return () => {
      window.clearTimeout(fallback)
    }
  }, [status, router])

  if (status === 'failed') {
    return (
      <div className="text-center py-16 space-y-4">
        <div className="text-destructive text-5xl">✕</div>
        <h2 className="text-xl font-semibold">{t('failed')}</h2>
        <p className="text-muted-foreground max-w-xs mx-auto">{t('failedDescription')}</p>
        <Link href={`/${locale}/analyze`} className={buttonVariants()}>
          {t('retryAnalysis')}
        </Link>
      </div>
    )
  }

  const messageKey =
    status === 'completed'
      ? 'statusLoadingResults'
      : status === 'validating'
        ? 'statusValidating'
        : status === 'processing'
          ? 'statusProcessing'
          : 'statusPending'

  return (
    <div className="flex flex-col items-center py-16 gap-6">
      <Loader2 className="w-14 h-14 animate-spin text-primary" />
      <p className="text-lg text-muted-foreground">{t(messageKey)}</p>
    </div>
  )
}
