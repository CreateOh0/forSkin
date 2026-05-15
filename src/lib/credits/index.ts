import type { SupabaseClient } from '@supabase/supabase-js'

export async function checkCredits(
  userId: string,
  supabase: SupabaseClient
): Promise<boolean> {
  const { data, error } = await supabase
    .from('credits')
    .select('balance')
    .eq('user_id', userId)
    .single()

  if (error || !data) return false
  return (data as { balance: number }).balance > 0
}

export async function deductCredit(
  userId: string,
  analysisId: string,
  supabase: SupabaseClient
): Promise<void> {
  const { error } = await supabase.rpc('deduct_credit', {
    p_user_id: userId,
    p_analysis_id: analysisId,
  })
  if (error) throw new Error(`Credit deduction failed: ${error.message}`)
}

export async function refundCredit(
  userId: string,
  analysisId: string,
  supabase: SupabaseClient
): Promise<void> {
  await supabase.rpc('refund_credit', {
    p_user_id: userId,
    p_analysis_id: analysisId,
  })
  // Refund is best-effort — swallow errors to avoid masking the original failure
}
