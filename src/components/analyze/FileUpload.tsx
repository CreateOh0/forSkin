'use client'

import { useRef } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Upload } from 'lucide-react'

interface Props {
  onFileSelected: (blob: Blob) => void
}

export function FileUpload({ onFileSelected }: Props) {
  const t = useTranslations('Analyze')
  const inputRef = useRef<HTMLInputElement>(null)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) onFileSelected(file)
    e.target.value = ''
  }

  return (
    <div className="text-center">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleChange}
      />
      <Button
        variant="outline"
        size="lg"
        className="gap-2"
        onClick={() => inputRef.current?.click()}
      >
        <Upload className="w-4 h-4" />
        {t('uploadPhoto')}
      </Button>
    </div>
  )
}
