import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

import { SummaryCards } from '../SummaryCards'

describe('SummaryCards', () => {
  it('renders total analyses count', () => {
    render(
      <SummaryCards
        totalAnalyses={12}
        latestScore={78}
        topConcern="dryness"
      />
    )
    expect(screen.getByText('12')).toBeInTheDocument()
  })

  it('renders latest score', () => {
    render(
      <SummaryCards totalAnalyses={3} latestScore={65} topConcern="acne" />
    )
    expect(screen.getByText('65')).toBeInTheDocument()
  })

  it('renders top concern', () => {
    render(
      <SummaryCards totalAnalyses={1} latestScore={80} topConcern="sensitivity" />
    )
    expect(screen.getByText('sensitivity')).toBeInTheDocument()
  })

  it('renders dash when no data', () => {
    render(
      <SummaryCards totalAnalyses={0} latestScore={null} topConcern={null} />
    )
    const dashes = screen.getAllByText('—')
    expect(dashes.length).toBeGreaterThan(0)
  })
})
