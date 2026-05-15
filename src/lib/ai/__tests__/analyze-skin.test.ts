import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn(() => ({
    messages: { create: vi.fn() },
  })),
}))

vi.mock('@/lib/env', () => ({
  env: { ANTHROPIC_API_KEY: 'test-key' },
}))

const VALID_RESPONSE = {
  skin_type: '복합성',
  hydration_level: 6,
  overall_score: 72,
  concerns: ['모공', '블랙헤드'],
  diagnosis: '전반적으로 건강한 피부 상태입니다.',
  recommendations: [
    { category: '클렌징', advice: '저자극 클렌저 사용 권장', key_ingredients: ['세라마이드'] },
    { category: '토너', advice: '보습 토너 사용', key_ingredients: ['히알루론산'] },
    { category: '세럼', advice: '나이아신아마이드 세럼', key_ingredients: ['나이아신아마이드'] },
    { category: '보습제', advice: '가벼운 겔 타입', key_ingredients: ['알로에베라'] },
    { category: '선크림', advice: 'SPF50+ 매일 사용', key_ingredients: ['징크옥사이드'] },
  ],
}

describe('analyzeSkin', () => {
  let mockCreate: ReturnType<typeof vi.fn>

  beforeEach(async () => {
    const Anthropic = (await import('@anthropic-ai/sdk')).default as ReturnType<typeof vi.fn>
    mockCreate = vi.fn()
    Anthropic.mockReturnValue({ messages: { create: mockCreate } })
    vi.resetModules()
  })

  it('parses valid JSON response from Claude', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify(VALID_RESPONSE) }],
    })

    const { analyzeSkin } = await import('../analyze-skin')
    const result = await analyzeSkin('base64data', 'ko')

    expect(result.skin_type).toBe('복합성')
    expect(result.overall_score).toBe(72)
    expect(result.recommendations).toHaveLength(5)
  })

  it('parses JSON wrapped in markdown code blocks', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: '```json\n' + JSON.stringify(VALID_RESPONSE) + '\n```' }],
    })

    const { analyzeSkin } = await import('../analyze-skin')
    const result = await analyzeSkin('base64data', 'ko')

    expect(result.overall_score).toBe(72)
  })

  it('throws on invalid schema', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: '{"skin_type": "복합성"}' }],
    })

    const { analyzeSkin } = await import('../analyze-skin')
    await expect(analyzeSkin('base64data', 'ko')).rejects.toThrow()
  })
})
