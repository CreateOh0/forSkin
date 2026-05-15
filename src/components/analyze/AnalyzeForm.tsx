'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { CameraCapture } from './CameraCapture'
import { FileUpload } from './FileUpload'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import Image from 'next/image'

interface Props {
  locale: string
  creditBalance: number
}

export function AnalyzeForm({ locale, creditBalance }: Props) {
  const t = useTranslations('Analyze')
  const router = useRouter()
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleCapture = (blob: Blob) => {
    setCapturedBlob(blob)
    setPreviewUrl(URL.createObjectURL(blob))
    setError(null)
  }

  const handleRetake = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setCapturedBlob(null)
    setPreviewUrl(null)
  }

  const handleSubmit = async () => {
    if (!capturedBlob) return
    if (creditBalance <= 0) {
      setError(t('insufficientCredits'))
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('image', capturedBlob, 'photo.jpg')
      formData.append('locale', locale)

      const res = await fetch('/api/analyze', { method: 'POST', body: formData })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Analysis request failed')
        return
      }

      router.push(`/${locale}/results/${data.analysis_id}`)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (previewUrl) {
    return (
      <div className="space-y-4">
        <div className="relative aspect-[3/4] w-full max-w-md mx-auto rounded-xl overflow-hidden bg-zinc-900">
          <Image src={previewUrl} alt="Preview" fill className="object-cover" />
        </div>
        {error && <p className="text-destructive text-sm text-center">{error}</p>}
        <div className="flex gap-3 justify-center">
          <Button variant="outline" onClick={handleRetake} disabled={isSubmitting}>
            {t('retake')}
          </Button>
          <Button onClick={handleSubmit} size="lg" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {t('analyzing')}
              </>
            ) : (
              t('startAnalysis')
            )}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <CameraCapture onCapture={handleCapture} onError={setError} />
      <div className="flex items-center gap-4">
        <div className="flex-1 border-t" />
        <span className="text-sm text-muted-foreground">{t('orDivider')}</span>
        <div className="flex-1 border-t" />
      </div>
      <FileUpload onFileSelected={handleCapture} />
      {error && <p className="text-destructive text-sm text-center">{error}</p>}
    </div>
  )
}
