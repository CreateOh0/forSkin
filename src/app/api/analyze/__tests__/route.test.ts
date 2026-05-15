import { describe, it, expect, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))
vi.mock('@/lib/image/process', () => ({
  processImage: vi.fn().mockResolvedValue({
    original: Buffer.from('original'),
    thumbnail: Buffer.from('thumb'),
  }),
}))
vi.mock('@/lib/credits', () => ({
  checkCredits: vi.fn().mockResolvedValue(true),
}))
vi.mock('@upstash/qstash', () => ({
  Client: vi.fn(() => ({ publishJSON: vi.fn().mockResolvedValue({}) })),
}))
vi.mock('@/lib/env', () => ({
  env: {
    NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
    QSTASH_TOKEN: 'test-token',
  },
}))

function makeSupabaseMock() {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
    },
    storage: {
      from: vi.fn().mockReturnValue({
        upload: vi.fn().mockResolvedValue({ error: null }),
        createSignedUrl: vi.fn().mockResolvedValue({
          data: { signedUrl: 'https://example.com/image.jpg' },
        }),
      }),
    },
    from: vi.fn().mockReturnValue({
      insert: vi.fn().mockResolvedValue({ error: null }),
    }),
  }
}

describe('POST /api/analyze', () => {
  it('returns 401 when not authenticated', async () => {
    const { createClient } = await import('@/lib/supabase/server')
    ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    })

    const { POST } = await import('../route')
    const formData = new FormData()
    formData.append('image', new Blob(['data'], { type: 'image/jpeg' }), 'photo.jpg')
    const req = new NextRequest('http://localhost/api/analyze', {
      method: 'POST',
      body: formData,
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('returns 402 when no credits', async () => {
    const { createClient } = await import('@/lib/supabase/server')
    ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue(makeSupabaseMock())
    const { checkCredits } = await import('@/lib/credits')
    ;(checkCredits as ReturnType<typeof vi.fn>).mockResolvedValue(false)

    const { POST } = await import('../route')
    const formData = new FormData()
    formData.append('image', new Blob(['data'], { type: 'image/jpeg' }), 'photo.jpg')
    const req = new NextRequest('http://localhost/api/analyze', {
      method: 'POST',
      body: formData,
    })
    const res = await POST(req)
    expect(res.status).toBe(402)
  })

  it('returns 400 when no image provided', async () => {
    const { createClient } = await import('@/lib/supabase/server')
    ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue(makeSupabaseMock())
    const { checkCredits } = await import('@/lib/credits')
    ;(checkCredits as ReturnType<typeof vi.fn>).mockResolvedValue(true)

    const { POST } = await import('../route')
    const formData = new FormData()
    formData.append('locale', 'ko')
    const req = new NextRequest('http://localhost/api/analyze', {
      method: 'POST',
      body: formData,
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns analysis_id on success', async () => {
    const { createClient } = await import('@/lib/supabase/server')
    ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue(makeSupabaseMock())
    const { checkCredits } = await import('@/lib/credits')
    ;(checkCredits as ReturnType<typeof vi.fn>).mockResolvedValue(true)

    const { POST } = await import('../route')
    const formData = new FormData()
    formData.append('image', new Blob(['data'], { type: 'image/jpeg' }), 'photo.jpg')
    formData.append('locale', 'ko')
    const req = new NextRequest('http://localhost/api/analyze', {
      method: 'POST',
      body: formData,
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.analysis_id).toBeDefined()
    expect(typeof body.analysis_id).toBe('string')
  })
})
