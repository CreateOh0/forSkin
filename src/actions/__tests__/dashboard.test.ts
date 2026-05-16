import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFrom = vi.fn()
const mockStorage = { from: vi.fn() }
const mockSupabase = {
  from: mockFrom,
  storage: mockStorage,
  auth: { getUser: vi.fn() },
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabase)),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => mockSupabase),
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { deleteAnalysis, submitRating } from '../dashboard'

describe('deleteAnalysis', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
    })
  })

  it('deletes storage files and DB record', async () => {
    const mockSelect = vi.fn().mockReturnThis()
    const mockEq = vi.fn().mockReturnThis()
    const mockSingle = vi.fn().mockResolvedValue({
      data: { image_url: 'user-1/analysis-1/original.jpg', user_id: 'user-1' },
      error: null,
    })
    const mockDelete = vi.fn().mockReturnThis()
    const mockDeleteEq = vi.fn().mockResolvedValue({ error: null })

    mockFrom.mockImplementation((table: string) => {
      if (table === 'analyses') {
        return {
          select: mockSelect,
          eq: mockEq,
          single: mockSingle,
          delete: mockDelete,
        }
      }
      return { select: mockSelect, eq: mockEq, single: mockSingle }
    })
    mockEq.mockReturnThis()
    mockDelete.mockReturnValue({ eq: mockDeleteEq })

    const mockRemove = vi.fn().mockResolvedValue({ error: null })
    mockStorage.from.mockReturnValue({ remove: mockRemove })

    const formData = new FormData()
    formData.set('analysisId', 'analysis-1')
    await deleteAnalysis(formData)

    expect(mockRemove).toHaveBeenCalledWith([
      'user-1/analysis-1/original.jpg',
      'user-1/analysis-1/thumb.jpg',
    ])
  })

  it('returns error when user not authenticated', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null } })
    const formData = new FormData()
    formData.set('analysisId', 'analysis-1')
    const result = await deleteAnalysis(formData)
    expect(result).toEqual({ error: 'Unauthorized' })
  })
})

describe('submitRating', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
    })
  })

  it('upserts ratings for each category', async () => {
    const mockUpsert = vi.fn().mockResolvedValue({ error: null })
    mockFrom.mockReturnValue({ upsert: mockUpsert })

    const formData = new FormData()
    formData.set('analysisId', 'analysis-1')
    formData.set('category_moisturizer', '4')
    formData.set('comment_moisturizer', 'good product')

    await submitRating(formData)

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          analysis_id: 'analysis-1',
          user_id: 'user-1',
          category: 'moisturizer',
          rating: 4,
          comment: 'good product',
        }),
      ]),
      expect.objectContaining({ onConflict: 'analysis_id,user_id,category' })
    )
  })
})
