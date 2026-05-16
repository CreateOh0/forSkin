import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

const mockRedirect = vi.hoisted(() => vi.fn((url: string) => { throw new Error(`REDIRECT:${url}`) }))
vi.mock('next/navigation', () => ({ redirect: mockRedirect }))

vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn(() => Promise.resolve((key: string) => key)),
}))

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

vi.mock('next/image', () => ({
  default: ({ alt }: { alt: string }) => <img alt={alt} />,
}))

vi.mock('@/actions/dashboard', () => ({
  deleteAnalysis: vi.fn(),
  submitRating: vi.fn(),
  getTopIngredients: vi.fn().mockResolvedValue([]),
}))

const mockSupabaseUser = { id: 'user-1' }

function makeChainableQuery(resolvedData = { data: [], error: null }) {
  const query: Record<string, unknown> = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    single: vi.fn().mockResolvedValue({ data: { balance: 3 }, error: null }),
    then: (resolve: (v: unknown) => void) => Promise.resolve(resolvedData).then(resolve),
  }
  query.select = vi.fn().mockReturnValue(query)
  query.eq = vi.fn().mockReturnValue(query)
  query.order = vi.fn().mockReturnValue(query)
  query.limit = vi.fn().mockReturnValue(query)
  return query
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() =>
    Promise.resolve({
      auth: {
        getUser: vi.fn(() => Promise.resolve({ data: { user: mockSupabaseUser } })),
      },
      from: vi.fn(() => makeChainableQuery()),
    })
  ),
}))

import DashboardPage from '../page'

describe('DashboardPage', () => {
  it('renders dashboard when authenticated', async () => {
    const page = await DashboardPage({ params: Promise.resolve({ locale: 'ko' }) })
    render(page)
    expect(screen.getByText('title')).toBeInTheDocument()
  })

  it('redirects when not authenticated', async () => {
    const { createClient } = await import('@/lib/supabase/server')
    vi.mocked(createClient).mockResolvedValueOnce({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
      from: vi.fn(),
    } as never)
    await expect(
      DashboardPage({ params: Promise.resolve({ locale: 'ko' }) })
    ).rejects.toThrow('REDIRECT:/ko/auth/login')
    expect(mockRedirect).toHaveBeenCalledWith('/ko/auth/login')
  })
})
