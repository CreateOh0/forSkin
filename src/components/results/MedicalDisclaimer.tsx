import { getTranslations } from 'next-intl/server'
import { AlertTriangle } from 'lucide-react'

interface Props {
  locale: string
}

export async function MedicalDisclaimer({ locale }: Props) {
  const t = await getTranslations({ locale, namespace: 'Results' })

  return (
    <div className="flex items-start gap-2 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-800 dark:text-amber-300">
      <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
      <p>{t('disclaimer')}</p>
    </div>
  )
}
