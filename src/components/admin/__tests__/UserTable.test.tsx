import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

import { UserTable } from '../UserTable'
import type { AdminUser } from '@/actions/admin'

const mockUsers: AdminUser[] = [
  {
    id: 'u1',
    email: 'alice@test.com',
    name: 'Alice',
    role: 'user',
    created_at: '2026-05-01T00:00:00Z',
    balance: 10,
    banned_until: null,
  },
  {
    id: 'u2',
    email: 'bob@test.com',
    name: 'Bob',
    role: 'user',
    created_at: '2026-05-02T00:00:00Z',
    balance: 0,
    banned_until: '2126-01-01T00:00:00Z',
  },
]

describe('UserTable', () => {
  it('renders user emails', () => {
    render(<UserTable users={mockUsers} total={2} locale="ko" />)
    expect(screen.getByText('alice@test.com')).toBeInTheDocument()
    expect(screen.getByText('bob@test.com')).toBeInTheDocument()
  })

  it('shows balance', () => {
    render(<UserTable users={mockUsers} total={2} locale="ko" />)
    expect(screen.getByText('10')).toBeInTheDocument()
  })

  it('shows suspended status for banned user', () => {
    render(<UserTable users={mockUsers} total={2} locale="ko" />)
    expect(screen.getByText('suspended')).toBeInTheDocument()
  })

  it('shows empty state when no users', () => {
    render(<UserTable users={[]} total={0} locale="ko" />)
    expect(screen.getByText('noData')).toBeInTheDocument()
  })
})
