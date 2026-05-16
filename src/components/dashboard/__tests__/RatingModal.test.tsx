import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

vi.mock('@/actions/dashboard', () => ({
  submitRating: vi.fn().mockResolvedValue({}),
}))

import { RatingModal } from '../RatingModal'

describe('RatingModal', () => {
  it('renders category names', () => {
    render(
      <RatingModal
        analysisId="a-1"
        categories={['moisturizer', 'sunscreen']}
        onClose={vi.fn()}
      />
    )
    expect(screen.getByText('moisturizer')).toBeInTheDocument()
    expect(screen.getByText('sunscreen')).toBeInTheDocument()
  })

  it('renders 5 star buttons per category', () => {
    render(
      <RatingModal
        analysisId="a-1"
        categories={['moisturizer']}
        onClose={vi.fn()}
      />
    )
    // 5 stars for 1 category
    const stars = screen.getAllByRole('button', { name: /★/ })
    expect(stars.length).toBe(5)
  })

  it('calls onClose when cancel clicked', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(
      <RatingModal analysisId="a-1" categories={['moisturizer']} onClose={onClose} />
    )
    await user.click(screen.getByRole('button', { name: /✕/ }))
    expect(onClose).toHaveBeenCalled()
  })

  it('submits ratings on form submit', async () => {
    const user = userEvent.setup()
    const { submitRating } = await import('@/actions/dashboard')
    render(
      <RatingModal analysisId="a-1" categories={['moisturizer']} onClose={vi.fn()} />
    )
    // Click 4 stars for moisturizer
    const stars = screen.getAllByRole('button', { name: /★/ })
    await user.click(stars[3]) // 4th star = rating 4
    await user.click(screen.getByText('submitRating'))
    expect(submitRating).toHaveBeenCalled()
  })
})
