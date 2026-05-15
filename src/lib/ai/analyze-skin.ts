import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import { env } from '@/lib/env'
import { getAnalysisSystemPrompt, type Locale, type SkinAnalysisResult } from './prompts'

// CJS build supports factory call (without new) — required for Vitest mock compatibility
type AnthropicFactory = (config: { apiKey: string }) => InstanceType<typeof Anthropic>

const SkinAnalysisSchema = z.object({
  skin_type: z.string().min(1),
  hydration_level: z.number().int().min(1).max(10),
  overall_score: z.number().int().min(1).max(100),
  concerns: z.array(z.string()),
  diagnosis: z.string().min(1),
  recommendations: z
    .array(
      z.object({
        category: z.string().min(1),
        advice: z.string().min(1),
        key_ingredients: z.array(z.string()),
      })
    )
    .min(1),
})

export async function analyzeSkin(
  imageBase64: string,
  locale: Locale
): Promise<SkinAnalysisResult> {
  const client = (Anthropic as unknown as AnthropicFactory)({ apiKey: env.ANTHROPIC_API_KEY })
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system: getAnalysisSystemPrompt(locale),
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: 'image/jpeg', data: imageBase64 },
          },
          { type: 'text', text: 'Analyze this facial photo for skin condition.' },
        ],
      },
    ],
  })

  const text = response.content[0]?.type === 'text' ? response.content[0].text : ''

  const codeBlockMatch = text.match(/```(?:json)?\n?([\s\S]*?)\n?```/)
  const jsonStr = codeBlockMatch ? codeBlockMatch[1] : text.match(/\{[\s\S]*\}/)?.[0]

  if (!jsonStr) throw new Error('Claude returned no parseable JSON')

  const parsed = JSON.parse(jsonStr)
  return SkinAnalysisSchema.parse(parsed)
}
