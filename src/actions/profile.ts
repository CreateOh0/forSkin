'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function updateProfile(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const name = formData.get('name') as string
  const preferred_locale = formData.get('preferred_locale') as string

  const { error } = await supabase
    .from('users')
    .update({ name, preferred_locale })
    .eq('id', user.id)

  if (error) return { error: error.message }
  revalidatePath('/', 'layout')
  return { success: true }
}
