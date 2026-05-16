import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockRpc = vi.fn()
const mockFrom = vi.fn()
const mockAdminUsers = { updateUserById: vi.fn() }
const mockAdminSupabase = {
  from: mockFrom,
  rpc: mockRpc,
  auth: { getUser: vi.fn(), admin: mockAdminUsers },
}
const mockUserSupabase = {
  auth: { getUser: vi.fn() },
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => Promise.resolve(mockUserSupabase)),
}))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => mockAdminSupabase),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { adjustCredit, setSuspension, getUsers, getAdminOverview, getCostData } from '../admin'

describe('adjustCredit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUserSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'admin-1' } } })
    const mockSelect = vi.fn().mockReturnThis()
    const mockEq = vi.fn().mockReturnThis()
    const mockSingle = vi.fn().mockResolvedValue({ data: { role: 'admin' }, error: null })
    mockFrom.mockReturnValue({ select: mockSelect, eq: mockEq, single: mockSingle })
    mockSelect.mockReturnThis()
    mockEq.mockReturnThis()
  })

  it('calls adjust_credit RPC with correct params', async () => {
    mockRpc.mockResolvedValue({ error: null })
    const result = await adjustCredit('user-1', 5, '테스트 지급')
    expect(mockRpc).toHaveBeenCalledWith('adjust_credit', {
      p_user_id: 'user-1',
      p_delta: 5,
      p_admin_note: '테스트 지급',
    })
    expect(result).toEqual({})
  })

  it('returns error when not admin', async () => {
    const mockSelect = vi.fn().mockReturnThis()
    const mockEq = vi.fn().mockReturnThis()
    const mockSingle = vi.fn().mockResolvedValue({ data: { role: 'user' }, error: null })
    mockFrom.mockReturnValue({ select: mockSelect, eq: mockEq, single: mockSingle })
    mockSelect.mockReturnThis()
    mockEq.mockReturnThis()
    const result = await adjustCredit('user-1', 5, 'note')
    expect(result).toEqual({ error: 'Unauthorized' })
  })

  it('returns error when RPC fails', async () => {
    mockRpc.mockResolvedValue({ error: { message: 'rpc error' } })
    const result = await adjustCredit('user-1', 5, 'note')
    expect(result).toEqual({ error: 'rpc error' })
  })
})

describe('setSuspension', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUserSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'admin-1' } } })
    const mockSelect = vi.fn().mockReturnThis()
    const mockEq = vi.fn().mockReturnThis()
    const mockSingle = vi.fn().mockResolvedValue({ data: { role: 'admin' }, error: null })
    mockFrom.mockReturnValue({ select: mockSelect, eq: mockEq, single: mockSingle })
    mockSelect.mockReturnThis()
    mockEq.mockReturnThis()
  })

  it('bans user with 876000h duration', async () => {
    mockAdminUsers.updateUserById.mockResolvedValue({ error: null })
    const result = await setSuspension('user-1', true)
    expect(mockAdminUsers.updateUserById).toHaveBeenCalledWith('user-1', { ban_duration: '876000h' })
    expect(result).toEqual({})
  })

  it('unbans user with none duration', async () => {
    mockAdminUsers.updateUserById.mockResolvedValue({ error: null })
    const result = await setSuspension('user-1', false)
    expect(mockAdminUsers.updateUserById).toHaveBeenCalledWith('user-1', { ban_duration: 'none' })
    expect(result).toEqual({})
  })

  it('returns error when updateUserById fails', async () => {
    mockAdminUsers.updateUserById.mockResolvedValue({ error: { message: 'auth error' } })
    const result = await setSuspension('user-1', true)
    expect(result).toEqual({ error: 'auth error' })
  })
})
