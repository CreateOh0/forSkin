import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const mockChannel = {
  on: vi.fn().mockReturnThis(),
  subscribe: vi.fn().mockReturnThis(),
}

const mockSupabase = {
  from: vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { status: 'validating' } }),
      }),
    }),
  }),
  channel: vi.fn().mockReturnValue(mockChannel),
  removeChannel: vi.fn(),
}

vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => mockSupabase),
}))

import { useAnalysisStatus } from '../useAnalysisStatus'

describe('useAnalysisStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockChannel.on.mockReturnThis()
    mockChannel.subscribe.mockReturnThis()
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { status: 'validating' } }),
        }),
      }),
    })
    mockSupabase.channel.mockReturnValue(mockChannel)
  })

  it('starts with pending status', () => {
    const { result } = renderHook(() => useAnalysisStatus('analysis-123'))
    expect(result.current.status).toBe('pending')
  })

  it('updates status from initial fetch', async () => {
    const { result } = renderHook(() => useAnalysisStatus('analysis-123'))
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })
    expect(result.current.status).toBe('validating')
  })

  it('subscribes to realtime channel', () => {
    renderHook(() => useAnalysisStatus('analysis-123'))
    expect(mockSupabase.channel).toHaveBeenCalledWith('analysis:analysis-123')
  })
})
