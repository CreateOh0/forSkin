import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AnalysisStatus } from '../AnalysisStatus'
import { useAnalysisStatus } from '@/hooks/useAnalysisStatus'

vi.mock('@/hooks/useAnalysisStatus', () => ({
  useAnalysisStatus: vi.fn().mockReturnValue({ status: 'validating' }),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}))

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const map: Record<string, string> = {
      statusValidating: '얼굴을 인식하고 있습니다...',
      failed: '분석에 실패했습니다',
    }
    return map[key] ?? key
  },
}))

describe('AnalysisStatus', () => {
  it('shows validating message when status is validating', () => {
    render(<AnalysisStatus analysisId="analysis-123" locale="ko" />)
    expect(screen.getByText('얼굴을 인식하고 있습니다...')).toBeInTheDocument()
  })

  it('shows failed message when status is failed', () => {
    ;(useAnalysisStatus as ReturnType<typeof vi.fn>).mockReturnValue({ status: 'failed' })
    render(<AnalysisStatus analysisId="analysis-123" locale="ko" />)
    expect(screen.getByText('분석에 실패했습니다')).toBeInTheDocument()
  })
})
