'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { setSuspension } from '@/actions/admin'

interface Props {
  userId: string
  banned: boolean
  open: boolean
  onClose: () => void
}

export function SuspendConfirmDialog({ userId, banned, open, onClose }: Props) {
  const t = useTranslations('Admin')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleConfirm = async () => {
    setLoading(true)
    setError(null)
    const result = await setSuspension(userId, !banned)
    setLoading(false)
    if (result.error) {
      setError(result.error)
    } else {
      onClose()
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={v => !v && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {banned ? t('unsuspendConfirmTitle') : t('suspendConfirmTitle')}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {banned ? t('unsuspendConfirmDesc') : t('suspendConfirmDesc')}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && <p className="text-sm text-destructive px-6 pb-2">{error}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm} disabled={loading}>{t('confirm')}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
