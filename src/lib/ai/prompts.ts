import type { Locale } from '@/lib/supabase/types'

export type { Locale }

export type ValidationIssue = 'too_dark' | 'blurry' | 'no_face' | 'multiple_faces'

export interface FaceValidationResult {
  face_detected: boolean
  quality_pass: boolean
  issues: ValidationIssue[]
}

export interface Recommendation {
  category: string
  advice: string
  key_ingredients: string[]
}

export interface SkinAnalysisResult {
  skin_type: string
  hydration_level: number
  overall_score: number
  concerns: string[]
  diagnosis: string
  recommendations: Recommendation[]
}

export function getValidationPrompt(): string {
  return `Analyze this facial photo and determine if it is suitable for skin analysis.
Respond ONLY with valid JSON matching this exact schema, no markdown:
{
  "face_detected": boolean,
  "quality_pass": boolean,
  "issues": string[]
}
Allowed issue values: "too_dark", "blurry", "no_face", "multiple_faces"
Set quality_pass to false if the image is too dark, blurry, shows no single clear face, or shows multiple faces.`
}

const LANGUAGE_NAMES: Record<Locale, string> = {
  ko: 'Korean',
  en: 'English',
  ja: 'Japanese',
}

const SKIN_TYPE_EXAMPLES: Record<Locale, string> = {
  ko: '건성, 지성, 복합성, 민감성',
  en: 'Dry, Oily, Combination, Sensitive',
  ja: '乾燥肌, 脂性肌, 混合肌, 敏感肌',
}

const CATEGORY_EXAMPLES: Record<Locale, string> = {
  ko: '클렌징, 토너, 세럼, 보습제, 선크림',
  en: 'Cleanser, Toner, Serum, Moisturizer, Sunscreen',
  ja: 'クレンジング, トナー, セラム, 保湿剤, 日焼け止め',
}

export function getAnalysisSystemPrompt(locale: Locale): string {
  const language = LANGUAGE_NAMES[locale]
  return `You are a professional skincare analysis AI with dermatologist-level expertise.
Analyze the provided facial photo and respond ONLY with valid JSON — no markdown, no explanation.
ALL text field values must be written in ${language}.

Required JSON schema:
{
  "skin_type": string,
  "hydration_level": integer (1-10),
  "overall_score": integer (1-100),
  "concerns": string[],
  "diagnosis": string (max 300 characters),
  "recommendations": [
    {
      "category": string,
      "advice": string,
      "key_ingredients": string[]
    }
  ]
}

skin_type must be one of (in ${language}): ${SKIN_TYPE_EXAMPLES[locale]}
Provide exactly 5 recommendations with categories (in ${language}): ${CATEGORY_EXAMPLES[locale]}
Be specific, professional, and grounded in observable skin characteristics.
Do not diagnose medical conditions.`
}
