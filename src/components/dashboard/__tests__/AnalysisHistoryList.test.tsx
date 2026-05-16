import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

vi.mock('next/image', () => ({
  default: ({ alt }: { alt: string }) => <img alt={alt} />,
}))

vi.mock('@/actions/dashboard', () => ({
  deleteAnalysis: vi.fn().mockResolvedValue({}),
}))

vi.spyOn(window, 'confirm').mockReturnValue(true)

const mockAnalyses = [
  {
    id: 'a-1',
    created_at: '2026-05-15T10:00:00Z',
    thumbnail_url: 'https://example.com/thumb.jpg',
    status: 'completed',
    analysis_results: [{ overall_score: 75, concerns: ['dryness', 'dullness'] }],
    hasRating: false,
  },
  {
    id: 'a-2',
    created_at: '2026-05-10T10:00:00Z',
    thumbnail_url: null,
    status: 'failed',
    analysis_results: [],
    hasRating: false,
  },
]

import { AnalysisHistoryList } from '../AnalysisHistoryList'

describe('AnalysisHistoryList', () => {
  it('renders analysis rows', () => {
    render(<AnalysisHistoryList analyses={mockAnalyses} locale="ko" />)
    expect(screen.getAllByRole('listitem').length).toBe(2)
  })

  it('shows score for completed analysis', () => {
    render(<AnalysisHistoryList analyses={mockAnalyses} locale="ko" />)
    expect(screen.getByText('75')).toBeInTheDocument()
  })

  it('shows concerns badges', () => {
    render(<AnalysisHistoryList analyses={mockAnalyses} locale="ko" />)
    expect(screen.getByText('dryness')).toBeInTheDocument()
  })

  it('shows delete button', () => {
    render(<AnalysisHistoryList analyses={mockAnalyses} locale="ko" />)
    expect(screen.getAllByText('deleteAnalysis').length).toBeGreaterThan(0)
  })

  it('shows rate button for completed analyses without ratings', () => {
    render(<AnalysisHistoryList analyses={mockAnalyses} locale="ko" />)
    expect(screen.getByText('rateRecommendation')).toBeInTheDocument()
  })

  it('shows empty state when no analyses', () => {
    render(<AnalysisHistoryList analyses={[]} locale="ko" />)
    expect(screen.getByText('noAnalyses')).toBeInTheDocument()
  })
})
