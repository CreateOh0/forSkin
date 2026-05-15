import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { balance: 3 } }),
        }),
      }),
    }),
  }),
}))

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}))

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn().mockResolvedValue((key: string) => key),
}))

vi.mock('@/components/analyze/AnalyzeForm', () => ({
  AnalyzeForm: ({ creditBalance }: { creditBalance: number }) => (
    <div data-testid="analyze-form" data-credits={creditBalance} />
  ),
}))

describe('Analyze page', () => {
  it('renders AnalyzeForm with credit balance', async () => {
    const AnalyzePage = (await import('../page')).default
    const jsx = await AnalyzePage({ params: Promise.resolve({ locale: 'ko' }) })
    render(jsx)
    const form = screen.getByTestId('analyze-form')
    expect(form).toBeInTheDocument()
    expect(form.getAttribute('data-credits')).toBe('3')
  })
})
