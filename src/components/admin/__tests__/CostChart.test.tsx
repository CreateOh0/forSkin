import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

import { CostChart } from '../CostChart'
import type { CostDataPoint } from '@/actions/admin'

const mockData: CostDataPoint[] = [
  { date: '2026-05-14', call_count: 5, input_tokens: 5000, output_tokens: 2000, estimated_cost_usd: 0.015 },
  { date: '2026-05-15', call_count: 8, input_tokens: 8000, output_tokens: 3000, estimated_cost_usd: 0.024 },
  { date: '2026-05-16', call_count: 3, input_tokens: 3000, output_tokens: 1000, estimated_cost_usd: 0.009 },
]

describe('CostChart', () => {
  it('renders SVG when data present', () => {
    const { container } = render(<CostChart data={mockData} />)
    expect(container.querySelector('svg')).toBeInTheDocument()
  })

  it('renders polyline when data has multiple points', () => {
    const { container } = render(<CostChart data={mockData} />)
    expect(container.querySelector('polyline')).toBeInTheDocument()
  })

  it('shows noData when empty', () => {
    render(<CostChart data={[]} />)
    expect(screen.getByText('noData')).toBeInTheDocument()
  })

  it('renders period buttons', () => {
    render(<CostChart data={mockData} />)
    expect(screen.getByText('periodDay')).toBeInTheDocument()
    expect(screen.getByText('periodWeek')).toBeInTheDocument()
  })
})
