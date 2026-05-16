'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

async function requireAdmin(): Promise<{ userId: string } | { error: string }> {
  const supabase = await createClient()
  const { data, error: authError } = await supabase.auth.getUser()
  if (authError || !data.user) return { error: 'Unauthorized' }
  const user = data.user

  const adminSupabase = createAdminClient()
  const { data: profile } = await adminSupabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') return { error: 'Unauthorized' }
  return { userId: user.id }
}

export async function adjustCredit(
  userId: string,
  delta: number,
  note: string
): Promise<{ error?: string }> {
  const auth = await requireAdmin()
  if ('error' in auth) return auth

  const supabase = createAdminClient()
  const { error } = await supabase.rpc('adjust_credit', {
    p_user_id: userId,
    p_delta: delta,
    p_admin_note: note,
  })

  if (error) return { error: error.message }
  revalidatePath('/', 'layout')
  return {}
}

export async function setSuspension(
  userId: string,
  banned: boolean
): Promise<{ error?: string }> {
  const auth = await requireAdmin()
  if ('error' in auth) return auth

  const supabase = createAdminClient()
  const { error } = await supabase.auth.admin.updateUserById(userId, {
    ban_duration: banned ? '876000h' : 'none',
  })

  if (error) return { error: error.message }
  revalidatePath('/', 'layout')
  return {}
}

export type AdminUser = {
  id: string
  email: string
  name: string | null
  role: string
  created_at: string
  balance: number
  banned_until: string | null
}

export async function getUsers(
  search?: string,
  page = 0
): Promise<{ users: AdminUser[]; total: number; error?: string }> {
  const auth = await requireAdmin()
  if ('error' in auth) return { users: [], total: 0, error: auth.error }

  const supabase = createAdminClient()
  const pageSize = 10
  const from = page * pageSize
  const to = from + pageSize - 1

  let query = supabase
    .from('users')
    .select('id, email, name, role, created_at', { count: 'exact' })
    .range(from, to)
    .order('created_at', { ascending: false })

  if (search) {
    query = query.ilike('email', `%${search}%`)
  }

  const { data: users, count, error } = await query
  if (error) return { users: [], total: 0, error: error.message }

  const userIds = (users ?? []).map(u => u.id)
  const { data: credits } = await supabase
    .from('credits')
    .select('user_id, balance')
    .in('user_id', userIds)

  const balanceMap = Object.fromEntries((credits ?? []).map(c => [c.user_id, c.balance]))

  const bannedMap: Record<string, string | null> = {}
  for (const uid of userIds) {
    const { data: authUser } = await supabase.auth.admin.getUserById(uid)
    if (authUser?.user) {
      bannedMap[uid] = authUser.user.banned_until ?? null
    }
  }

  const result: AdminUser[] = (users ?? []).map(u => ({
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    created_at: u.created_at,
    balance: balanceMap[u.id] ?? 0,
    banned_until: bannedMap[u.id] ?? null,
  }))

  return { users: result, total: count ?? 0 }
}

export type OverviewData = {
  todayAnalyses: number
  todayCost: number
  newUsers: number
}

export async function getAdminOverview(): Promise<OverviewData & { error?: string }> {
  const auth = await requireAdmin()
  if ('error' in auth) return { todayAnalyses: 0, todayCost: 0, newUsers: 0, error: auth.error }

  const supabase = createAdminClient()
  const todayStart = new Date()
  todayStart.setUTCHours(0, 0, 0, 0)
  const todayISO = todayStart.toISOString()

  const { data: analyses } = await supabase
    .from('analyses')
    .select('estimated_cost_usd')
    .eq('status', 'completed')
    .gte('created_at', todayISO)

  const todayAnalyses = analyses?.length ?? 0
  const todayCost = (analyses ?? []).reduce((sum, a) => sum + (a.estimated_cost_usd ?? 0), 0)

  const { count: userCount } = await supabase
    .from('users')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', todayISO)

  const newUsers = userCount ?? 0

  return { todayAnalyses, todayCost, newUsers }
}

export type CostDataPoint = {
  date: string
  call_count: number
  input_tokens: number
  output_tokens: number
  estimated_cost_usd: number
}

export async function getCostData(
  period: 'day' | 'week'
): Promise<CostDataPoint[]> {
  const auth = await requireAdmin()
  if ('error' in auth) return []

  const supabase = createAdminClient()
  const days = period === 'day' ? 1 : 7
  const since = new Date()
  since.setDate(since.getDate() - days)

  const { data } = await supabase
    .from('analyses')
    .select('created_at, input_tokens, output_tokens, estimated_cost_usd')
    .eq('status', 'completed')
    .gte('created_at', since.toISOString())
    .order('created_at', { ascending: true })

  const byDate: Record<string, CostDataPoint> = {}
  for (const row of data ?? []) {
    const date = row.created_at.slice(0, 10)
    if (!byDate[date]) {
      byDate[date] = { date, call_count: 0, input_tokens: 0, output_tokens: 0, estimated_cost_usd: 0 }
    }
    byDate[date].call_count++
    byDate[date].input_tokens  += row.input_tokens  ?? 0
    byDate[date].output_tokens += row.output_tokens ?? 0
    byDate[date].estimated_cost_usd += row.estimated_cost_usd ?? 0
  }

  return Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date))
}
