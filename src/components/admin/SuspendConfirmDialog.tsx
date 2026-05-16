'use client'

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

  const handleConfirm = async () => {
    await setSuspension(userId, !banned)
    onClose()
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
        <AlertDialogFooter>
          <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm}>{t('confirm')}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
