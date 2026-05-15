'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { Locale } from '@/lib/supabase/types'

export async function updateProfile(formData: FormData): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const name = formData.get('name') as string
  const preferred_locale = formData.get('preferred_locale') as Locale

  await supabase
    .from('users')
    .update({ name, preferred_locale })
    .eq('id', user.id)

  revalidatePath('/', 'layout')
}
