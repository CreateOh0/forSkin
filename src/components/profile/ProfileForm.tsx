'use client'

import { useState, useRef } from 'react'
import { useTranslations } from 'next-intl'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { updateProfile, deleteAccount } from '@/actions/profile'

interface Props {
  locale: string
  profile: {
    name: string | null
    preferred_locale: string
    avatar_url: string | null
  }
}

export function ProfileForm({ locale, profile }: Props) {
  const t = useTranslations('Profile')
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [avatarPreview, setAvatarPreview] = useState<string | null>(profile.avatar_url)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const formData = new FormData(e.currentTarget)
    const result = await updateProfile(formData)
    if (result?.error) setError(result.error)
    else setSaved(true)
    setLoading(false)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) setAvatarPreview(URL.createObjectURL(file))
  }

  const handleDeleteAccount = async () => {
    const formData = new FormData()
    formData.set('locale', locale)
    await deleteAccount(formData)
  }

  const deleteWord = locale === 'ja' ? '削除' : locale === 'en' ? 'delete' : '삭제'

  return (
    <div className="space-y-10">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Avatar */}
        <div>
          <Label>{t('avatar')}</Label>
          <div className="flex items-center gap-4 mt-2">
            {avatarPreview ? (
              <div className="relative w-16 h-16 rounded-full overflow-hidden">
                <Image src={avatarPreview} alt="" fill className="object-cover" />
              </div>
            ) : (
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center text-2xl text-muted-foreground">
                ?
              </div>
            )}
            <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
              {t('changeAvatar')}
            </Button>
            <input
              ref={fileRef}
              name="avatar"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarChange}
            />
          </div>
        </div>

        {/* Name */}
        <div>
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" defaultValue={profile.name ?? ''} />
        </div>

        {/* Locale */}
        <div>
          <Label htmlFor="preferred_locale">{t('preferredLocale')}</Label>
          <select
            name="preferred_locale"
            defaultValue={profile.preferred_locale}
            className="w-full border rounded px-3 py-2 mt-1 bg-background"
          >
            <option value="ko">한국어</option>
            <option value="en">English</option>
            <option value="ja">日本語</option>
          </select>
        </div>

        {error && <p className="text-destructive text-sm">{error}</p>}
        {saved && <p className="text-green-600 text-sm">{t('saved')}</p>}
        <Button type="submit" disabled={loading}>{t('save')}</Button>
      </form>

      {/* Account deletion */}
      <div className="border border-destructive/30 rounded-lg p-6 space-y-4">
        <h2 className="font-semibold text-destructive">{t('deleteAccountTitle')}</h2>
        <p className="text-sm text-muted-foreground">{t('deleteAccountDescription')}</p>
        <p className="text-sm">{t('deleteAccountConfirm')}</p>
        <Input
          value={deleteConfirm}
          onChange={e => setDeleteConfirm(e.target.value)}
          placeholder={t('deleteAccountPlaceholder')}
          className="max-w-xs"
        />
        <Button
          variant="destructive"
          disabled={deleteConfirm !== deleteWord}
          onClick={handleDeleteAccount}
        >
          {t('deleteAccountButton')}
        </Button>
      </div>
    </div>
  )
}
