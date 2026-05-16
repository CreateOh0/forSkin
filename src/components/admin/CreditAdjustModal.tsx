'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { adjustCredit } from '@/actions/admin'

interface Props {
  userId: string
  userName: string | null
  open: boolean
  onClose: () => void
}

export function CreditAdjustModal({ userId, userName, open, onClose }: Props) {
  const t = useTranslations('Admin')
  const [delta, setDelta] = useState('')
  const [note, setNote]   = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    const parsed = parseInt(delta, 10)
    if (isNaN(parsed) || parsed === 0) return
    setLoading(true)
    setError(null)
    const result = await adjustCredit(userId, parsed, note)
    setLoading(false)
    if (result.error) {
      setError(result.error)
    } else {
      setDelta('')
      setNote('')
      onClose()
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('creditAdjustTitle')} — {userName ?? userId}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label>{t('creditDelta')}</Label>
            <Input
              type="number"
              value={delta}
              onChange={e => setDelta(e.target.value)}
              placeholder="+5 or -3"
            />
          </div>
          <div className="grid gap-2">
            <Label>{t('note')}</Label>
            <Input
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder={t('note')}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t('cancel')}</Button>
          <Button onClick={handleSubmit} disabled={loading || !delta}>
            {t('confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
