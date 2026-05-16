import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))
vi.mock('@/actions/admin', () => ({
  adjustCredit: vi.fn().mockResolvedValue({}),
}))

import { CreditAdjustModal } from '../CreditAdjustModal'
import { adjustCredit } from '@/actions/admin'

describe('CreditAdjustModal', () => {
  beforeEach(() => {
    vi.mocked(adjustCredit).mockClear()
  })

  it('calls adjustCredit with parsed delta on submit', async () => {
    const user = userEvent.setup()
    render(
      <CreditAdjustModal userId="u1" userName="Alice" open onClose={vi.fn()} />
    )
    await user.clear(screen.getByRole('spinbutton'))
    await user.type(screen.getByRole('spinbutton'), '5')
    await user.type(screen.getByPlaceholderText('note'), '테스트')
    await user.click(screen.getByText('confirm'))
    expect(adjustCredit).toHaveBeenCalledWith('u1', 5, '테스트')
  })

  it('does not submit when delta is empty', async () => {
    const user = userEvent.setup()
    render(
      <CreditAdjustModal userId="u1" userName="Alice" open onClose={vi.fn()} />
    )
    await user.click(screen.getByText('confirm'))
    expect(adjustCredit).not.toHaveBeenCalled()
  })
})
