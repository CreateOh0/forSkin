import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

import { ScoreChart } from '../ScoreChart'

const mockData = [
  { date: '2026-05-01', score: 60 },
  { date: '2026-05-05', score: 70 },
  { date: '2026-05-10', score: 75 },
  { date: '2026-05-16', score: 80 },
]

describe('ScoreChart', () => {
  it('renders SVG chart', () => {
    const { container } = render(<ScoreChart data={mockData} />)
    expect(container.querySelector('svg')).toBeInTheDocument()
  })

  it('renders period filter buttons', () => {
    render(<ScoreChart data={mockData} />)
    expect(screen.getByText('periodWeek')).toBeInTheDocument()
    expect(screen.getByText('periodAll')).toBeInTheDocument()
  })

  it('shows empty state when no data', () => {
    render(<ScoreChart data={[]} />)
    expect(screen.getByText('noAnalyses')).toBeInTheDocument()
  })

  it('renders polyline when data present', () => {
    const { container } = render(<ScoreChart data={mockData} />)
    expect(container.querySelector('polyline')).toBeInTheDocument()
  })
})
