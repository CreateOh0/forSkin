'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import type { Locale } from '@/lib/supabase/types'

export async function updateProfile(formData: FormData): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const name = formData.get('name') as string
  const preferred_locale = formData.get('preferred_locale') as Locale
  const avatarFile = formData.get('avatar') as File | null

  let avatar_url: string | undefined

  if (avatarFile && avatarFile.size > 0) {
    const buffer = Buffer.from(await avatarFile.arrayBuffer())
    const path = `avatars/${user.id}/avatar.jpg`
    const { error: uploadError } = await supabase.storage
      .from('images')
      .upload(path, buffer, { contentType: 'image/jpeg', upsert: true })

    if (!uploadError) {
      const { data: signed } = await supabase.storage
        .from('images')
        .createSignedUrl(path, 60 * 60 * 24 * 365)
      avatar_url = signed?.signedUrl
    }
  }

  const updatePayload: { name: string; preferred_locale: Locale; avatar_url?: string } = { name, preferred_locale }
  if (avatar_url) updatePayload.avatar_url = avatar_url

  await supabase.from('users').update(updatePayload).eq('id', user.id)

  revalidatePath('/', 'layout')
  return {}
}

export async function deleteAccount(formData: FormData): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const locale = formData.get('locale') as string ?? 'ko'

  const adminSupabase = createAdminClient()
  const { error } = await adminSupabase.auth.admin.deleteUser(user.id)
  if (error) return { error: error.message }

  redirect(`/${locale}`)
}
