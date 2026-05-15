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
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'analysis-1',
              user_id: 'user-1',
              status: 'processing',
              locale: 'ko',
              analysis_results: null,
            },
          }),
        }),
      }),
    }),
  }),
}))

vi.mock('next/navigation', () => ({ notFound: vi.fn() }))

vi.mock('@/components/results/AnalysisStatus', () => ({
  AnalysisStatus: ({ analysisId }: { analysisId: string }) => (
    <div data-testid="analysis-status" data-id={analysisId} />
  ),
}))

vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn().mockResolvedValue((key: string) => key),
}))

describe('Results page', () => {
  it('shows AnalysisStatus when analysis is still processing', async () => {
    const ResultsPage = (await import('../page')).default
    const jsx = await ResultsPage({
      params: Promise.resolve({ locale: 'ko', id: 'analysis-1' }),
    })
    render(jsx)
    expect(screen.getByTestId('analysis-status')).toBeInTheDocument()
  })
})
