import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

function makeSupabase(overrides: Record<string, unknown> = {}) {
  return {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { balance: 3 }, error: null }),
        }),
      }),
    }),
    rpc: vi.fn().mockResolvedValue({ error: null }),
    ...overrides,
  } as unknown as SupabaseClient
}

describe('checkCredits', () => {
  it('returns true when balance > 0', async () => {
    const { checkCredits } = await import('../index')
    const supabase = makeSupabase()
    const result = await checkCredits('user-123', supabase)
    expect(result).toBe(true)
  })

  it('returns false when balance is 0', async () => {
    const { checkCredits } = await import('../index')
    const supabase = makeSupabase()
    ;(supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { balance: 0 }, error: null }),
        }),
      }),
    })
    const result = await checkCredits('user-123', supabase)
    expect(result).toBe(false)
  })

  it('returns false when user has no credits row', async () => {
    const { checkCredits } = await import('../index')
    const supabase = makeSupabase()
    ;(supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }),
        }),
      }),
    })
    const result = await checkCredits('user-123', supabase)
    expect(result).toBe(false)
  })
})

describe('deductCredit', () => {
  it('calls deduct_credit RPC with correct args', async () => {
    const { deductCredit } = await import('../index')
    const supabase = makeSupabase()
    await deductCredit('user-123', 'analysis-456', supabase)
    expect(supabase.rpc).toHaveBeenCalledWith('deduct_credit', {
      p_user_id: 'user-123',
      p_analysis_id: 'analysis-456',
    })
  })
})

describe('refundCredit', () => {
  it('calls refund_credit RPC with correct args', async () => {
    const { refundCredit } = await import('../index')
    const supabase = makeSupabase()
    await refundCredit('user-123', 'analysis-456', supabase)
    expect(supabase.rpc).toHaveBeenCalledWith('refund_credit', {
      p_user_id: 'user-123',
      p_analysis_id: 'analysis-456',
    })
  })
})
