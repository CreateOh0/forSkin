'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { submitRating } from '@/actions/dashboard'

interface Props {
  analysisId: string
  categories: string[]
  onClose: () => void
}

export function RatingModal({ analysisId, categories, onClose }: Props) {
  const t = useTranslations('Dashboard')
  const [ratings, setRatings] = useState<Record<string, number>>({})
  const [comments, setComments] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const handleSubmit = async () => {
    setLoading(true)
    const formData = new FormData()
    formData.set('analysisId', analysisId)
    for (const [cat, rating] of Object.entries(ratings)) {
      formData.set(`category_${cat}`, String(rating))
      if (comments[cat]) formData.set(`comment_${cat}`, comments[cat])
    }
    await submitRating(formData)
    setDone(true)
    setLoading(false)
    setTimeout(onClose, 1000)
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-background rounded-lg w-full max-w-md max-h-[80vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-lg">{t('rateRecommendation')}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground" aria-label="✕">✕</button>
        </div>

        {done ? (
          <p className="text-center py-8 text-primary font-medium">{t('ratingSubmitted')}</p>
        ) : (
          <>
            <div className="space-y-6">
              {categories.map(cat => (
                <div key={cat}>
                  <p className="font-medium mb-2">{cat}</p>
                  <div className="flex gap-1 mb-2">
                    {[1, 2, 3, 4, 5].map(star => (
                      <button
                        key={star}
                        aria-label={`★ ${star}`}
                        onClick={() => setRatings(prev => ({ ...prev, [cat]: star }))}
                        className={`text-2xl transition-colors ${
                          (ratings[cat] ?? 0) >= star ? 'text-yellow-400' : 'text-muted-foreground'
                        }`}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    placeholder={t('ratingComment')}
                    value={comments[cat] ?? ''}
                    onChange={e => setComments(prev => ({ ...prev, [cat]: e.target.value }))}
                    className="w-full border rounded px-3 py-1 text-sm"
                  />
                </div>
              ))}
            </div>
            <Button
              className="w-full mt-6"
              onClick={handleSubmit}
              disabled={loading || Object.keys(ratings).length === 0}
            >
              {t('submitRating')}
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
