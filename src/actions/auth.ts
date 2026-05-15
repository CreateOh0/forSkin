'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

export async function login(formData: FormData) {
  const supabase = await createClient()
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const locale = formData.get('locale') as string ?? 'ko'

  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return { error: error.message }

  revalidatePath('/', 'layout')
  redirect(`/${locale}/dashboard`)
}

export async function signup(formData: FormData) {
  const supabase = await createClient()
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const name = formData.get('name') as string
  const locale = formData.get('locale') as string ?? 'ko'

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name } },
  })
  if (error) return { error: error.message }

  revalidatePath('/', 'layout')
  redirect(`/${locale}/dashboard`)
}

export async function logout() {
  const supabase = await createClient()
  const locale = 'ko'

  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect(`/${locale}`)
}

export async function loginWithGoogle(locale: string) {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?locale=${locale}`,
    },
  })
  if (error) return { error: error.message }
  if (data.url) redirect(data.url)
}
