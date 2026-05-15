import Anthropic from '@anthropic-ai/sdk'
import { env } from '@/lib/env'
import { getValidationPrompt, type FaceValidationResult } from './prompts'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnthropicFactory = (config: { apiKey: string }) => InstanceType<typeof Anthropic>

export async function validateFace(imageBase64: string): Promise<FaceValidationResult> {
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

  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    return { face_detected: false, quality_pass: false, issues: ['no_face'] }
  }

  try {
    const parsed = JSON.parse(jsonMatch[0])
    return {
      face_detected: Boolean(parsed.face_detected),
      quality_pass: Boolean(parsed.quality_pass),
      issues: Array.isArray(parsed.issues) ? parsed.issues : [],
    }
  } catch {
    return { face_detected: false, quality_pass: false, issues: ['no_face'] }
  }
}
