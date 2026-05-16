import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: {
      create: vi.fn(),
    },
  })),
}))

vi.mock('@/lib/env', () => ({
  env: { ANTHROPIC_API_KEY: 'test-key' },
}))

describe('validateFace', () => {
  let mockCreate: ReturnType<typeof vi.fn>

  beforeEach(async () => {
    const Anthropic = (await import('@anthropic-ai/sdk')).default as ReturnType<typeof vi.fn>
    mockCreate = vi.fn()
    Anthropic.mockImplementation(() => ({ messages: { create: mockCreate } }))
    vi.resetModules()
  })

  it('returns face_detected true when Claude confirms face', async () => {
    mockCreate.mockResolvedValue({
      content: [
        {
          type: 'text',
          text: '{"face_detected":true,"quality_pass":true,"issues":[]}',
        },
      ],
      usage: { input_tokens: 50, output_tokens: 30 },
    })

    const { validateFace } = await import('../validate-face')
    const result = await validateFace('base64imagedata')

    expect(result.result.face_detected).toBe(true)
    expect(result.result.quality_pass).toBe(true)
    expect(result.result.issues).toEqual([])
    expect(result.usage.input_tokens).toBe(50)
    expect(result.usage.output_tokens).toBe(30)
  })

  it('returns face_detected false for no_face issue', async () => {
    mockCreate.mockResolvedValue({
      content: [
        {
          type: 'text',
          text: '{"face_detected":false,"quality_pass":false,"issues":["no_face"]}',
        },
      ],
      usage: { input_tokens: 50, output_tokens: 30 },
    })

    const { validateFace } = await import('../validate-face')
    const result = await validateFace('base64imagedata')

    expect(result.result.face_detected).toBe(false)
    expect(result.result.issues).toContain('no_face')
  })

  it('handles malformed JSON gracefully', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'not valid json at all' }],
      usage: { input_tokens: 50, output_tokens: 30 },
    })

    const { validateFace } = await import('../validate-face')
    const result = await validateFace('base64imagedata')

    expect(result.result.face_detected).toBe(false)
    expect(result.result.quality_pass).toBe(false)
    expect(result.result.issues).toContain('no_face')
  })
})
