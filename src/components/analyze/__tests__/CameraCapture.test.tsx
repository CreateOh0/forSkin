import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CameraCapture } from '../CameraCapture'

Object.defineProperty(global.navigator, 'mediaDevices', {
  value: {
    getUserMedia: vi.fn().mockRejectedValue(new Error('Camera not available in test')),
  },
  writable: true,
})

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

describe('CameraCapture', () => {
  it('renders start camera button', () => {
    render(<CameraCapture onCapture={vi.fn()} onError={vi.fn()} />)
    expect(screen.getByRole('button', { name: /startCamera/i })).toBeInTheDocument()
  })

  it('calls onError when camera access fails', async () => {
    const onError = vi.fn()
    render(<CameraCapture onCapture={vi.fn()} onError={onError} />)
    await userEvent.click(screen.getByRole('button', { name: /startCamera/i }))
    expect(onError).toHaveBeenCalledWith(expect.any(String))
  })
})
