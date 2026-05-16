import Anthropic from '@anthropic-ai/sdk'
import { env } from '@/lib/env'
import { getValidationPrompt, type FaceValidationResult } from './prompts'

type AnthropicFactory = (config: { apiKey: string }) => InstanceType<typeof Anthropic>

export async function validateFace(imageBase64: string): Promise<{
  result: FaceValidationResult
  usage: { input_tokens: number; output_tokens: number }
}> {
  // CJS build supports factory call (without new) — required for Vitest mock compatibility
  const client = (Anthropic as unknown as AnthropicFactory)({ apiKey: env.ANTHROPIC_API_KEY })
  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 256,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: 'image/jpeg', data: imageBase64 },
          },
          { type: 'text', text: getValidationPrompt() },
        ],
      },
    ],
  })

  const text = response.content[0]?.type === 'text' ? response.content[0].text : ''
  const usage = {
    input_tokens: response.usage.input_tokens,
    output_tokens: response.usage.output_tokens,
  }

  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    return { result: { face_detected: false, quality_pass: false, issues: ['no_face'] }, usage }
  }

  try {
    const parsed = JSON.parse(jsonMatch[0])
    return {
      result: {
        face_detected: Boolean(parsed.face_detected),
        quality_pass: Boolean(parsed.quality_pass),
        issues: Array.isArray(parsed.issues) ? parsed.issues : [],
      },
      usage,
    }
  } catch {
    return { result: { face_detected: false, quality_pass: false, issues: ['no_face'] }, usage }
  }
}
