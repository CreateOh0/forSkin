# forSkin — Plan 2: Core Analysis

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the full skin analysis pipeline — camera capture, Sharp image processing, Upstash QStash async queue, 2-stage Claude Vision AI (Haiku validation → Sonnet analysis), Supabase Realtime status UX, and image lifecycle cron cleanup.

**Architecture:** User captures photo → `/api/analyze` validates auth/credits, processes image with Sharp, uploads to Supabase Storage, creates `analyses` record (status: `validating`), enqueues job to Upstash QStash, returns `analysis_id` immediately. Client navigates to `/results/:id` and subscribes to Supabase Realtime for status updates. QStash delivers webhook to `/api/worker/analyze` which runs Haiku validation then Sonnet analysis, updates status via Realtime, deducts credit on success. Cron at `/api/cron/cleanup-images` deletes original images 24h after analysis.

**Tech Stack:** `@anthropic-ai/sdk` (Claude Vision), `@upstash/qstash` (async queue + webhook), `sharp` (image processing), Supabase Realtime (status push), Supabase Storage (Signed URLs), Zod (response validation), Vitest (TDD)

**Prerequisite:** Plan 1 Foundation must be complete (schema, auth, env, i18n scaffolded).

---

## File Map

```
forSkin/
├── vercel.json                                    # Create: Vercel cron schedule
├── .env.local.example                             # Modify: add AI + queue + cron vars
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── analyze/
│   │   │   │   └── route.ts                       # Create: POST — upload + queue
│   │   │   ├── worker/
│   │   │   │   └── analyze/
│   │   │   │       └── route.ts                   # Create: POST — QStash webhook
│   │   │   └── cron/
│   │   │       └── cleanup-images/
│   │   │           └── route.ts                   # Create: GET — delete expired originals
│   │   └── [locale]/
│   │       ├── analyze/
│   │       │   └── page.tsx                       # Create: camera/upload entry page
│   │       └── results/
│   │           └── [id]/
│   │               └── page.tsx                   # Create: realtime status + results
│   ├── components/
│   │   ├── analyze/
│   │   │   ├── CameraCapture.tsx                  # Create: getUserMedia webcam UI
│   │   │   ├── FileUpload.tsx                     # Create: file input fallback
│   │   │   └── AnalyzeForm.tsx                    # Create: orchestrates capture + submit
│   │   └── results/
│   │       ├── AnalysisStatus.tsx                 # Create: realtime loading states
│   │       ├── SkinScoreCard.tsx                  # Create: score + type + concerns
│   │       ├── RecommendationList.tsx             # Create: skincare routine cards
│   │       └── MedicalDisclaimer.tsx              # Create: required legal notice
│   ├── hooks/
│   │   └── useAnalysisStatus.ts                   # Create: Supabase Realtime subscription
│   ├── lib/
│   │   ├── ai/
│   │   │   ├── prompts.ts                         # Create: system prompts + AI types
│   │   │   ├── validate-face.ts                   # Create: Haiku face validation
│   │   │   └── analyze-skin.ts                    # Create: Sonnet skin analysis
│   │   ├── image/
│   │   │   └── process.ts                         # Create: Sharp compress + thumbnail
│   │   ├── credits/
│   │   │   └── index.ts                           # Create: check + deduct + refund
│   │   ├── supabase/
│   │   │   └── admin.ts                           # Create: service role client (no cookies)
│   │   └── env.ts                                 # Modify: add ANTHROPIC_API_KEY, QStash, cron vars
│   └── test/
│       └── setup.ts                               # No change needed
├── supabase/
│   └── migrations/
│       └── 002_credit_functions.sql               # Create: deduct_credit + refund_credit RPCs + Realtime
└── messages/
    ├── ko.json                                    # Modify: add Analyze + Results namespaces
    ├── en.json                                    # Modify: add Analyze + Results namespaces
    └── ja.json                                    # Modify: add Analyze + Results namespaces
```

---

## Task 1: Install Packages + Extend Env

**Files:**
- Modify: `package.json` (via npm install)
- Modify: `src/lib/env.ts`
- Modify: `.env.local.example`

- [ ] **Step 1: Install runtime packages**

```bash
npm install @anthropic-ai/sdk @upstash/qstash
```

Expected: No peer dependency errors. `@anthropic-ai/sdk` and `@upstash/qstash` appear in `package.json` dependencies.

- [ ] **Step 2: Update env template**

Add these lines to `.env.local.example` below the existing content:

```
# Anthropic — get from https://console.anthropic.com/settings/keys
ANTHROPIC_API_KEY=sk-ant-...

# Upstash QStash — get from https://console.upstash.com/qstash
QSTASH_TOKEN=...
QSTASH_CURRENT_SIGNING_KEY=sig_...
QSTASH_NEXT_SIGNING_KEY=sig_...

# Cron security — any random 32-char string
CRON_SECRET=your-random-cron-secret-here
```

Copy values to `.env.local` from their respective dashboards.

- [ ] **Step 3: Extend env.ts with new vars**

Replace the entire content of `src/lib/env.ts`:

```typescript
import { z } from 'zod'

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),
  ANTHROPIC_API_KEY: z.string().min(1),
  QSTASH_TOKEN: z.string().min(1),
  QSTASH_CURRENT_SIGNING_KEY: z.string().min(1),
  QSTASH_NEXT_SIGNING_KEY: z.string().min(1),
  CRON_SECRET: z.string().min(1),
})

export const env = envSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  QSTASH_TOKEN: process.env.QSTASH_TOKEN,
  QSTASH_CURRENT_SIGNING_KEY: process.env.QSTASH_CURRENT_SIGNING_KEY,
  QSTASH_NEXT_SIGNING_KEY: process.env.QSTASH_NEXT_SIGNING_KEY,
  CRON_SECRET: process.env.CRON_SECRET,
})
```

- [ ] **Step 4: Verify env loads**

```bash
npm run build 2>&1 | head -30
```

Expected: No "Missing required env" errors. (Zod will throw at startup if any are missing.)

- [ ] **Step 5: Commit**

```bash
git add .env.local.example src/lib/env.ts package.json package-lock.json
git commit -m "feat: add Anthropic SDK, QStash, and extend env validation"
```

---

## Task 2: DB Migration — Credit Functions + Realtime

**Files:**
- Create: `supabase/migrations/002_credit_functions.sql`
- Create: `src/lib/supabase/admin.ts`

- [ ] **Step 1: Write credit functions migration**

Create `supabase/migrations/002_credit_functions.sql`:

```sql
-- ============================================================
-- CREDIT TRANSACTION FUNCTIONS
-- Uses SECURITY DEFINER to bypass RLS for atomic operations
-- ============================================================

CREATE OR REPLACE FUNCTION public.deduct_credit(
  p_user_id uuid,
  p_analysis_id uuid
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Atomically decrement — fails if balance would go negative (CHECK constraint)
  UPDATE credits
  SET balance = balance - 1
  WHERE user_id = p_user_id AND balance >= 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Insufficient credits for user %', p_user_id;
  END IF;

  INSERT INTO credit_transactions (user_id, amount, type, reference_id)
  VALUES (p_user_id, -1, 'analysis', p_analysis_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.refund_credit(
  p_user_id uuid,
  p_analysis_id uuid
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Idempotent: only refund if not already refunded for this analysis
  IF EXISTS (
    SELECT 1 FROM credit_transactions
    WHERE user_id = p_user_id
      AND reference_id = p_analysis_id
      AND type = 'refund'
  ) THEN
    RETURN;
  END IF;

  -- Only refund if a matching deduction exists
  IF NOT EXISTS (
    SELECT 1 FROM credit_transactions
    WHERE user_id = p_user_id
      AND reference_id = p_analysis_id
      AND type = 'analysis'
  ) THEN
    RETURN;
  END IF;

  UPDATE credits SET balance = balance + 1 WHERE user_id = p_user_id;

  INSERT INTO credit_transactions (user_id, amount, type, reference_id)
  VALUES (p_user_id, 1, 'refund', p_analysis_id);
END;
$$;

-- ============================================================
-- ENABLE REALTIME for analyses table
-- Clients subscribe to analyses status changes
-- ============================================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.analyses;
```

- [ ] **Step 2: Apply migration in Supabase Dashboard**

Go to: Supabase Dashboard → SQL Editor → New query → paste the SQL above → Run.

Expected: "Success. No rows returned"

- [ ] **Step 3: Verify RPCs are callable**

In Supabase Dashboard → Database → Functions, confirm `deduct_credit` and `refund_credit` appear.

- [ ] **Step 4: Create Supabase admin client**

Create `src/lib/supabase/admin.ts`:

```typescript
import { createClient } from '@supabase/supabase-js'
import type { Database } from './types'

// Service-role client for server-to-server operations (worker, cron).
// No cookie context — bypasses RLS. Never expose to browser.
export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/002_credit_functions.sql src/lib/supabase/admin.ts
git commit -m "feat: add credit RPC functions, enable Realtime for analyses, admin client"
```

---

## Task 3: Sharp Image Processing

**Files:**
- Create: `src/lib/image/process.ts`
- Create: `src/lib/image/__tests__/process.test.ts`

- [ ] **Step 1: Write failing test**

Create `src/lib/image/__tests__/process.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import sharp from 'sharp'
import { processImage } from '../process'

async function makeTestImage(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 200, g: 150, b: 100 },
    },
  })
    .jpeg()
    .toBuffer()
}

describe('processImage', () => {
  it('returns original and thumbnail buffers', async () => {
    const input = await makeTestImage(800, 600)
    const result = await processImage(input)
    expect(result.original).toBeInstanceOf(Buffer)
    expect(result.thumbnail).toBeInstanceOf(Buffer)
    expect(result.original.length).toBeGreaterThan(0)
    expect(result.thumbnail.length).toBeGreaterThan(0)
  })

  it('thumbnail is exactly 400x400', async () => {
    const input = await makeTestImage(800, 600)
    const { thumbnail } = await processImage(input)
    const meta = await sharp(thumbnail).metadata()
    expect(meta.width).toBe(400)
    expect(meta.height).toBe(400)
  })

  it('does not upscale original smaller than 1920px', async () => {
    const input = await makeTestImage(200, 200)
    const { original } = await processImage(input)
    const meta = await sharp(original).metadata()
    expect(meta.width).toBeLessThanOrEqual(200)
  })

  it('original is JPEG format', async () => {
    const input = await makeTestImage(400, 400)
    const { original } = await processImage(input)
    const meta = await sharp(original).metadata()
    expect(meta.format).toBe('jpeg')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test:run -- src/lib/image/__tests__/process.test.ts
```

Expected: FAIL — `Cannot find module '../process'`

- [ ] **Step 3: Implement processImage**

Create `src/lib/image/process.ts`:

```typescript
import sharp from 'sharp'

export interface ProcessedImage {
  original: Buffer  // JPEG ≤1920×1920, quality 85 — for AI analysis
  thumbnail: Buffer // JPEG 400×400 cover crop — for dashboard display
}

export async function processImage(input: Buffer): Promise<ProcessedImage> {
  const [original, thumbnail] = await Promise.all([
    sharp(input)
      .resize(1920, 1920, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85, progressive: true })
      .toBuffer(),
    sharp(input)
      .resize(400, 400, { fit: 'cover', position: 'centre' })
      .jpeg({ quality: 70 })
      .toBuffer(),
  ])
  return { original, thumbnail }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm run test:run -- src/lib/image/__tests__/process.test.ts
```

Expected: `4 passed`

- [ ] **Step 5: Commit**

```bash
git add src/lib/image/
git commit -m "feat: add Sharp image processing — compress + thumbnail"
```

---

## Task 4: AI Prompts + Types

**Files:**
- Create: `src/lib/ai/prompts.ts`

No separate test needed — pure data (prompts + types). Tested implicitly through validate-face and analyze-skin tests.

- [ ] **Step 1: Create prompts + AI types**

Create `src/lib/ai/prompts.ts`:

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/ai/prompts.ts
git commit -m "feat: add Claude AI prompts and types for face validation and skin analysis"
```

---

## Task 5: Haiku Face Validation

**Files:**
- Create: `src/lib/ai/validate-face.ts`
- Create: `src/lib/ai/__tests__/validate-face.test.ts`

- [ ] **Step 1: Write failing test**

Create `src/lib/ai/__tests__/validate-face.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn(() => ({
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
    Anthropic.mockReturnValue({ messages: { create: mockCreate } })
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
    })

    const { validateFace } = await import('../validate-face')
    const result = await validateFace('base64imagedata')

    expect(result.face_detected).toBe(true)
    expect(result.quality_pass).toBe(true)
    expect(result.issues).toEqual([])
  })

  it('returns face_detected false for no_face issue', async () => {
    mockCreate.mockResolvedValue({
      content: [
        {
          type: 'text',
          text: '{"face_detected":false,"quality_pass":false,"issues":["no_face"]}',
        },
      ],
    })

    const { validateFace } = await import('../validate-face')
    const result = await validateFace('base64imagedata')

    expect(result.face_detected).toBe(false)
    expect(result.issues).toContain('no_face')
  })

  it('handles malformed JSON gracefully', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'not valid json at all' }],
    })

    const { validateFace } = await import('../validate-face')
    const result = await validateFace('base64imagedata')

    expect(result.face_detected).toBe(false)
    expect(result.quality_pass).toBe(false)
    expect(result.issues).toContain('no_face')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test:run -- src/lib/ai/__tests__/validate-face.test.ts
```

Expected: FAIL — `Cannot find module '../validate-face'`

- [ ] **Step 3: Implement validateFace**

Create `src/lib/ai/validate-face.ts`:

```typescript
import Anthropic from '@anthropic-ai/sdk'
import { env } from '@/lib/env'
import { getValidationPrompt, type FaceValidationResult } from './prompts'

const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY })

export async function validateFace(imageBase64: string): Promise<FaceValidationResult> {
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
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm run test:run -- src/lib/ai/__tests__/validate-face.test.ts
```

Expected: `3 passed`

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/validate-face.ts src/lib/ai/__tests__/validate-face.test.ts
git commit -m "feat: add Haiku face validation with JSON parsing and fallback"
```

---

## Task 6: Sonnet Skin Analysis

**Files:**
- Create: `src/lib/ai/analyze-skin.ts`
- Create: `src/lib/ai/__tests__/analyze-skin.test.ts`

- [ ] **Step 1: Write failing test**

Create `src/lib/ai/__tests__/analyze-skin.test.ts`:

```typescript
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
      content: [{ type: 'text', text: '{"skin_type": "복합성"}' }], // missing required fields
    })

    const { analyzeSkin } = await import('../analyze-skin')
    await expect(analyzeSkin('base64data', 'ko')).rejects.toThrow()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test:run -- src/lib/ai/__tests__/analyze-skin.test.ts
```

Expected: FAIL — `Cannot find module '../analyze-skin'`

- [ ] **Step 3: Implement analyzeSkin**

Create `src/lib/ai/analyze-skin.ts`:

```typescript
import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import { env } from '@/lib/env'
import { getAnalysisSystemPrompt, type Locale, type SkinAnalysisResult } from './prompts'

const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY })

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

  // Handle both raw JSON and markdown-wrapped JSON
  const codeBlockMatch = text.match(/```(?:json)?\n?([\s\S]*?)\n?```/)
  const jsonStr = codeBlockMatch ? codeBlockMatch[1] : text.match(/\{[\s\S]*\}/)?.[0]

  if (!jsonStr) throw new Error('Claude returned no parseable JSON')

  const parsed = JSON.parse(jsonStr)
  return SkinAnalysisSchema.parse(parsed)
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm run test:run -- src/lib/ai/__tests__/analyze-skin.test.ts
```

Expected: `3 passed`

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/analyze-skin.ts src/lib/ai/__tests__/analyze-skin.test.ts
git commit -m "feat: add Sonnet skin analysis with Zod schema validation"
```

---

## Task 7: Credits Utility

**Files:**
- Create: `src/lib/credits/index.ts`
- Create: `src/lib/credits/__tests__/index.test.ts`

- [ ] **Step 1: Write failing test**

Create `src/lib/credits/__tests__/index.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

function makeSupabase(overrides: Record<string, unknown> = {}) {
  return {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { balance: 3 }, error: null }),
        }),
      }),
    }),
    rpc: vi.fn().mockResolvedValue({ error: null }),
    ...overrides,
  } as unknown as SupabaseClient
}

describe('checkCredits', () => {
  it('returns true when balance > 0', async () => {
    const { checkCredits } = await import('../index')
    const supabase = makeSupabase()
    const result = await checkCredits('user-123', supabase)
    expect(result).toBe(true)
  })

  it('returns false when balance is 0', async () => {
    const { checkCredits } = await import('../index')
    const supabase = makeSupabase()
    ;(supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { balance: 0 }, error: null }),
        }),
      }),
    })
    const result = await checkCredits('user-123', supabase)
    expect(result).toBe(false)
  })

  it('returns false when user has no credits row', async () => {
    const { checkCredits } = await import('../index')
    const supabase = makeSupabase()
    ;(supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }),
        }),
      }),
    })
    const result = await checkCredits('user-123', supabase)
    expect(result).toBe(false)
  })
})

describe('deductCredit', () => {
  it('calls deduct_credit RPC with correct args', async () => {
    const { deductCredit } = await import('../index')
    const supabase = makeSupabase()
    await deductCredit('user-123', 'analysis-456', supabase)
    expect(supabase.rpc).toHaveBeenCalledWith('deduct_credit', {
      p_user_id: 'user-123',
      p_analysis_id: 'analysis-456',
    })
  })
})

describe('refundCredit', () => {
  it('calls refund_credit RPC with correct args', async () => {
    const { refundCredit } = await import('../index')
    const supabase = makeSupabase()
    await refundCredit('user-123', 'analysis-456', supabase)
    expect(supabase.rpc).toHaveBeenCalledWith('refund_credit', {
      p_user_id: 'user-123',
      p_analysis_id: 'analysis-456',
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test:run -- src/lib/credits/__tests__/index.test.ts
```

Expected: FAIL — `Cannot find module '../index'`

- [ ] **Step 3: Implement credits utility**

Create `src/lib/credits/index.ts`:

```typescript
import type { SupabaseClient } from '@supabase/supabase-js'

export async function checkCredits(
  userId: string,
  supabase: SupabaseClient
): Promise<boolean> {
  const { data, error } = await supabase
    .from('credits')
    .select('balance')
    .eq('user_id', userId)
    .single()

  if (error || !data) return false
  return data.balance > 0
}

export async function deductCredit(
  userId: string,
  analysisId: string,
  supabase: SupabaseClient
): Promise<void> {
  const { error } = await supabase.rpc('deduct_credit', {
    p_user_id: userId,
    p_analysis_id: analysisId,
  })
  if (error) throw new Error(`Credit deduction failed: ${error.message}`)
}

export async function refundCredit(
  userId: string,
  analysisId: string,
  supabase: SupabaseClient
): Promise<void> {
  await supabase.rpc('refund_credit', {
    p_user_id: userId,
    p_analysis_id: analysisId,
  })
  // Refund is best-effort — swallow errors to avoid masking the original failure
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm run test:run -- src/lib/credits/__tests__/index.test.ts
```

Expected: `5 passed`

- [ ] **Step 5: Commit**

```bash
git add src/lib/credits/
git commit -m "feat: add credit check/deduct/refund utilities using Supabase RPCs"
```

---

## Task 8: `/api/analyze` Route

**Files:**
- Create: `src/app/api/analyze/route.ts`
- Create: `src/app/api/analyze/__tests__/route.test.ts`

- [ ] **Step 1: Write failing test**

Create `src/app/api/analyze/__tests__/route.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))
vi.mock('@/lib/image/process', () => ({
  processImage: vi.fn().mockResolvedValue({
    original: Buffer.from('original'),
    thumbnail: Buffer.from('thumb'),
  }),
}))
vi.mock('@/lib/credits', () => ({
  checkCredits: vi.fn().mockResolvedValue(true),
}))
vi.mock('@upstash/qstash', () => ({
  Client: vi.fn(() => ({ publishJSON: vi.fn().mockResolvedValue({}) })),
}))
vi.mock('@/lib/env', () => ({
  env: {
    NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
    QSTASH_TOKEN: 'test-token',
  },
}))

function makeSupabaseMock() {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
    },
    storage: {
      from: vi.fn().mockReturnValue({
        upload: vi.fn().mockResolvedValue({ error: null }),
        createSignedUrl: vi.fn().mockResolvedValue({
          data: { signedUrl: 'https://example.com/image.jpg' },
        }),
      }),
    },
    from: vi.fn().mockReturnValue({
      insert: vi.fn().mockResolvedValue({ error: null }),
    }),
  }
}

describe('POST /api/analyze', () => {
  it('returns 401 when not authenticated', async () => {
    const { createClient } = await import('@/lib/supabase/server')
    ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    })

    const { POST } = await import('../route')
    const formData = new FormData()
    formData.append('image', new Blob(['data'], { type: 'image/jpeg' }), 'photo.jpg')
    const req = new NextRequest('http://localhost/api/analyze', {
      method: 'POST',
      body: formData,
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('returns 402 when no credits', async () => {
    const { createClient } = await import('@/lib/supabase/server')
    ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue(makeSupabaseMock())
    const { checkCredits } = await import('@/lib/credits')
    ;(checkCredits as ReturnType<typeof vi.fn>).mockResolvedValue(false)

    const { POST } = await import('../route')
    const formData = new FormData()
    formData.append('image', new Blob(['data'], { type: 'image/jpeg' }), 'photo.jpg')
    const req = new NextRequest('http://localhost/api/analyze', {
      method: 'POST',
      body: formData,
    })
    const res = await POST(req)
    expect(res.status).toBe(402)
  })

  it('returns 400 when no image provided', async () => {
    const { createClient } = await import('@/lib/supabase/server')
    ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue(makeSupabaseMock())
    const { checkCredits } = await import('@/lib/credits')
    ;(checkCredits as ReturnType<typeof vi.fn>).mockResolvedValue(true)

    const { POST } = await import('../route')
    const formData = new FormData()
    formData.append('locale', 'ko')
    const req = new NextRequest('http://localhost/api/analyze', {
      method: 'POST',
      body: formData,
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns analysis_id on success', async () => {
    const { createClient } = await import('@/lib/supabase/server')
    ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue(makeSupabaseMock())
    const { checkCredits } = await import('@/lib/credits')
    ;(checkCredits as ReturnType<typeof vi.fn>).mockResolvedValue(true)

    const { POST } = await import('../route')
    const formData = new FormData()
    formData.append('image', new Blob(['data'], { type: 'image/jpeg' }), 'photo.jpg')
    formData.append('locale', 'ko')
    const req = new NextRequest('http://localhost/api/analyze', {
      method: 'POST',
      body: formData,
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.analysis_id).toBeDefined()
    expect(typeof body.analysis_id).toBe('string')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test:run -- src/app/api/analyze/__tests__/route.test.ts
```

Expected: FAIL — `Cannot find module '../route'`

- [ ] **Step 3: Implement the route**

Create `src/app/api/analyze/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { processImage } from '@/lib/image/process'
import { checkCredits } from '@/lib/credits'
import { env } from '@/lib/env'
import { Client as QStashClient } from '@upstash/qstash'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

export async function POST(req: NextRequest) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const hasCredits = await checkCredits(user.id, supabase)
  if (!hasCredits) {
    return NextResponse.json({ error: 'Insufficient credits' }, { status: 402 })
  }

  const formData = await req.formData()
  const image = formData.get('image') as File | null
  const locale = (formData.get('locale') as string) ?? 'ko'

  if (!image) {
    return NextResponse.json({ error: 'Image required' }, { status: 400 })
  }
  if (image.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: 'Image too large (max 10MB)' }, { status: 400 })
  }

  const imageBuffer = Buffer.from(await image.arrayBuffer())
  const { original, thumbnail } = await processImage(imageBuffer)

  const analysisId = crypto.randomUUID()
  const basePath = `${user.id}/${analysisId}`

  const [{ error: origError }, { error: thumbError }] = await Promise.all([
    supabase.storage.from('images').upload(`${basePath}/original.jpg`, original, {
      contentType: 'image/jpeg',
    }),
    supabase.storage.from('images').upload(`${basePath}/thumb.jpg`, thumbnail, {
      contentType: 'image/jpeg',
    }),
  ])

  if (origError || thumbError) {
    return NextResponse.json({ error: 'Storage upload failed' }, { status: 500 })
  }

  // Thumbnail: long-lived signed URL for dashboard display
  const { data: thumbSigned } = await supabase.storage
    .from('images')
    .createSignedUrl(`${basePath}/thumb.jpg`, 60 * 60 * 24 * 365)

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

  const { error: dbError } = await supabase.from('analyses').insert({
    id: analysisId,
    user_id: user.id,
    // Store storage path — worker fetches via admin client
    image_url: `${basePath}/original.jpg`,
    thumbnail_url: thumbSigned?.signedUrl ?? '',
    locale,
    status: 'validating',
    original_expires_at: expiresAt,
  })

  if (dbError) {
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  const qstash = new QStashClient({ token: env.QSTASH_TOKEN })
  await qstash.publishJSON({
    url: `${env.NEXT_PUBLIC_APP_URL}/api/worker/analyze`,
    body: { analysis_id: analysisId, user_id: user.id },
    retries: 2,
  })

  return NextResponse.json({ analysis_id: analysisId })
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm run test:run -- src/app/api/analyze/__tests__/route.test.ts
```

Expected: `4 passed`

- [ ] **Step 5: Commit**

```bash
git add src/app/api/analyze/
git commit -m "feat: add /api/analyze route — upload, queue, return analysis_id"
```

---

## Task 9: `/api/worker/analyze` Route

**Files:**
- Create: `src/app/api/worker/analyze/route.ts`

No unit test for the full worker — it integrates too many services. Integration tested manually via curl after deployment. Correctness verified by checking `analyses.status` in Supabase Dashboard after a real run.

- [ ] **Step 1: Create worker route**

Create `src/app/api/worker/analyze/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { Receiver } from '@upstash/qstash'
import { createAdminClient } from '@/lib/supabase/admin'
import { validateFace } from '@/lib/ai/validate-face'
import { analyzeSkin } from '@/lib/ai/analyze-skin'
import { deductCredit, refundCredit } from '@/lib/credits'
import { env } from '@/lib/env'
import type { Locale } from '@/lib/ai/prompts'

const receiver = new Receiver({
  currentSigningKey: env.QSTASH_CURRENT_SIGNING_KEY,
  nextSigningKey: env.QSTASH_NEXT_SIGNING_KEY,
})

export async function POST(req: NextRequest) {
  const body = await req.text()
  const signature = req.headers.get('upstash-signature') ?? ''

  const isValid = await receiver
    .verify({
      signature,
      body,
      url: `${env.NEXT_PUBLIC_APP_URL}/api/worker/analyze`,
    })
    .catch(() => false)

  if (!isValid) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const { analysis_id, user_id } = JSON.parse(body) as {
    analysis_id: string
    user_id: string
  }

  const supabase = createAdminClient()

  const updateStatus = async (status: string) => {
    await supabase.from('analyses').update({ status }).eq('id', analysis_id)
  }

  // Fetch analysis to get image path and locale
  const { data: analysis } = await supabase
    .from('analyses')
    .select('image_url, locale')
    .eq('id', analysis_id)
    .single()

  if (!analysis) {
    return NextResponse.json({ error: 'Analysis not found' }, { status: 404 })
  }

  // Download original image from storage
  const { data: imageData, error: downloadError } = await supabase.storage
    .from('images')
    .download(analysis.image_url!)

  if (downloadError || !imageData) {
    await updateStatus('failed')
    return NextResponse.json({ error: 'Image download failed' }, { status: 500 })
  }

  const imageBuffer = Buffer.from(await imageData.arrayBuffer())
  const imageBase64 = imageBuffer.toString('base64')

  // Stage 1 — Haiku face validation (no credit deducted yet)
  const validation = await validateFace(imageBase64)

  if (!validation.face_detected || !validation.quality_pass) {
    await updateStatus('failed')
    // No credit deduction happened — no refund needed
    return NextResponse.json({ error: 'Validation failed', issues: validation.issues })
  }

  // Deduct credit before expensive Sonnet call
  try {
    await deductCredit(user_id, analysis_id, supabase)
  } catch {
    await updateStatus('failed')
    return NextResponse.json({ error: 'Credit deduction failed' }, { status: 500 })
  }

  // Stage 2 — Sonnet skin analysis
  await updateStatus('processing')

  let analysisResult
  try {
    analysisResult = await analyzeSkin(imageBase64, analysis.locale as Locale)
  } catch {
    // Retry once
    try {
      analysisResult = await analyzeSkin(imageBase64, analysis.locale as Locale)
    } catch {
      await refundCredit(user_id, analysis_id, supabase)
      await updateStatus('failed')
      return NextResponse.json({ error: 'Analysis failed after retry' }, { status: 500 })
    }
  }

  // Fetch previous completed analysis for comparison
  const { data: prevAnalysisRow } = await supabase
    .from('analyses')
    .select('analysis_results(overall_score, hydration_level)')
    .eq('user_id', user_id)
    .eq('status', 'completed')
    .neq('id', analysis_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  type PrevResult = { overall_score: number | null; hydration_level: number | null }
  const prevResult = (prevAnalysisRow?.analysis_results as PrevResult[] | null)?.[0] ?? null

  const comparisonData =
    prevResult?.overall_score != null
      ? {
          overall_score: analysisResult.overall_score - prevResult.overall_score,
          hydration_level: analysisResult.hydration_level - (prevResult.hydration_level ?? 0),
        }
      : null

  // Save results
  const { error: insertError } = await supabase.from('analysis_results').insert({
    analysis_id,
    skin_type: analysisResult.skin_type,
    concerns: analysisResult.concerns,
    hydration_level: analysisResult.hydration_level,
    overall_score: analysisResult.overall_score,
    diagnosis_text: analysisResult.diagnosis,
    recommendations: analysisResult.recommendations,
    comparison_data: comparisonData,
    feature_points: [],
    raw_response: analysisResult,
  })

  if (insertError) {
    await refundCredit(user_id, analysis_id, supabase)
    await updateStatus('failed')
    return NextResponse.json({ error: 'Result save failed' }, { status: 500 })
  }

  await updateStatus('completed')
  return NextResponse.json({ success: true })
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/worker/analyze/
git commit -m "feat: add QStash worker — 2-stage AI analysis, credit deduction, Realtime status"
```

---

## Task 10: `/api/cron/cleanup-images` Route + Vercel Config

**Files:**
- Create: `src/app/api/cron/cleanup-images/route.ts`
- Create: `vercel.json`

- [ ] **Step 1: Create cron route**

Create `src/app/api/cron/cleanup-images/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { env } from '@/lib/env'

export async function GET(req: NextRequest) {
  // Verify Vercel cron auth header
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()

  // Find analyses with expired originals not yet deleted
  const { data: expired, error } = await supabase
    .from('analyses')
    .select('id, user_id, image_url')
    .lt('original_expires_at', new Date().toISOString())
    .is('original_deleted_at', null)
    .not('image_url', 'is', null)
    .limit(50) // Process in batches of 50

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!expired || expired.length === 0) {
    return NextResponse.json({ deleted: 0 })
  }

  let deleted = 0
  const errors: string[] = []

  for (const analysis of expired) {
    if (!analysis.image_url) continue

    const { error: storageError } = await supabase.storage
      .from('images')
      .remove([analysis.image_url])

    if (storageError) {
      errors.push(`${analysis.id}: ${storageError.message}`)
      continue
    }

    await supabase
      .from('analyses')
      .update({ original_deleted_at: new Date().toISOString() })
      .eq('id', analysis.id)

    deleted++
  }

  return NextResponse.json({ deleted, errors: errors.length > 0 ? errors : undefined })
}
```

- [ ] **Step 2: Create Vercel cron config**

Create `vercel.json` in project root:

```json
{
  "crons": [
    {
      "path": "/api/cron/cleanup-images",
      "schedule": "0 * * * *"
    }
  ]
}
```

This runs the cleanup every hour. Vercel passes a `CRON_SECRET` bearer token automatically if configured in environment variables.

- [ ] **Step 3: Add CRON_SECRET to Vercel dashboard**

In Vercel Project → Settings → Environment Variables → add `CRON_SECRET` with the same value as in `.env.local`.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/cron/ vercel.json
git commit -m "feat: add image lifecycle cron — delete expired originals hourly"
```

---

## Task 11: i18n Strings for Analyze + Results

**Files:**
- Modify: `messages/ko.json`
- Modify: `messages/en.json`
- Modify: `messages/ja.json`

- [ ] **Step 1: Add Korean strings**

Add these namespaces to `messages/ko.json` (merge with existing content):

```json
{
  "Analyze": {
    "title": "피부 분석",
    "subtitle": "얼굴 사진을 촬영하여 피부 상태를 분석받으세요",
    "creditInfo": "분석 1회에 크레딧 1개가 차감됩니다",
    "startCamera": "카메라 시작",
    "capturePhoto": "사진 촬영",
    "retake": "다시 찍기",
    "startAnalysis": "분석 시작",
    "uploadPhoto": "사진 업로드",
    "orDivider": "또는",
    "guide1": "얼굴 전체가 화면에 들어오도록 해주세요",
    "guide2": "밝은 조명 아래서 촬영해주세요",
    "guide3": "정면을 바라보고 눈을 떠 주세요",
    "cameraError": "카메라에 접근할 수 없습니다. 파일을 업로드해주세요",
    "uploading": "업로드 중...",
    "analyzing": "분석 요청 중...",
    "insufficientCredits": "크레딧이 부족합니다. 충전 후 이용해주세요"
  },
  "Results": {
    "title": "피부 분석 결과",
    "statusPending": "분석 준비 중...",
    "statusValidating": "얼굴을 인식하고 있습니다...",
    "statusProcessing": "피부 상태를 분석하고 있습니다...",
    "failed": "분석에 실패했습니다",
    "failedDescription": "이미지 품질이 분석 기준을 충족하지 못했습니다. 밝은 곳에서 정면 사진을 다시 촬영해 주세요.",
    "retryAnalysis": "다시 분석하기",
    "skinScore": "피부 점수",
    "skinType": "피부 타입",
    "hydrationLevel": "수분도",
    "concerns": "피부 고민",
    "diagnosis": "진단",
    "recommendations": "스킨케어 루틴 추천",
    "keyIngredients": "핵심 성분",
    "comparedToPrevious": "이전 대비",
    "improvement": "개선",
    "disclaimer": "본 분석 결과는 전문적인 의료 진단을 대체할 수 없으며, 참고용으로만 사용하십시오."
  }
}
```

- [ ] **Step 2: Add English strings**

Add these namespaces to `messages/en.json`:

```json
{
  "Analyze": {
    "title": "Skin Analysis",
    "subtitle": "Take a photo to get your personalized skin analysis",
    "creditInfo": "1 credit will be used per analysis",
    "startCamera": "Start Camera",
    "capturePhoto": "Take Photo",
    "retake": "Retake",
    "startAnalysis": "Analyze Skin",
    "uploadPhoto": "Upload Photo",
    "orDivider": "or",
    "guide1": "Make sure your entire face fits in the frame",
    "guide2": "Use good lighting — avoid shadows",
    "guide3": "Look directly at the camera with eyes open",
    "cameraError": "Camera access denied. Please upload a photo instead",
    "uploading": "Uploading...",
    "analyzing": "Submitting for analysis...",
    "insufficientCredits": "Insufficient credits. Please top up to continue"
  },
  "Results": {
    "title": "Skin Analysis Results",
    "statusPending": "Preparing analysis...",
    "statusValidating": "Detecting face...",
    "statusProcessing": "Analyzing skin condition...",
    "failed": "Analysis failed",
    "failedDescription": "Your image didn't meet quality requirements. Please retake in good lighting facing the camera directly.",
    "retryAnalysis": "Try Again",
    "skinScore": "Skin Score",
    "skinType": "Skin Type",
    "hydrationLevel": "Hydration",
    "concerns": "Concerns",
    "diagnosis": "Diagnosis",
    "recommendations": "Skincare Routine",
    "keyIngredients": "Key Ingredients",
    "comparedToPrevious": "vs last analysis",
    "improvement": "improvement",
    "disclaimer": "This analysis is not a substitute for professional medical diagnosis and should be used for reference only."
  }
}
```

- [ ] **Step 3: Add Japanese strings**

Add these namespaces to `messages/ja.json`:

```json
{
  "Analyze": {
    "title": "肌分析",
    "subtitle": "顔写真を撮影して、肌状態の分析を受けましょう",
    "creditInfo": "1回の分析につき1クレジットが消費されます",
    "startCamera": "カメラを起動",
    "capturePhoto": "撮影",
    "retake": "撮り直す",
    "startAnalysis": "分析開始",
    "uploadPhoto": "写真をアップロード",
    "orDivider": "または",
    "guide1": "顔全体がフレームに収まるようにしてください",
    "guide2": "明るい場所で撮影してください",
    "guide3": "カメラを正面から見て目を開けてください",
    "cameraError": "カメラへのアクセスが拒否されました。写真をアップロードしてください",
    "uploading": "アップロード中...",
    "analyzing": "分析リクエスト中...",
    "insufficientCredits": "クレジットが不足しています。チャージしてからお試しください"
  },
  "Results": {
    "title": "肌分析結果",
    "statusPending": "分析を準備中...",
    "statusValidating": "顔を認識しています...",
    "statusProcessing": "肌状態を分析しています...",
    "failed": "分析に失敗しました",
    "failedDescription": "画像の品質が基準を満たしていませんでした。明るい場所で正面から撮り直してください。",
    "retryAnalysis": "再分析する",
    "skinScore": "肌スコア",
    "skinType": "肌タイプ",
    "hydrationLevel": "水分量",
    "concerns": "肌の悩み",
    "diagnosis": "診断",
    "recommendations": "スキンケアルーティン",
    "keyIngredients": "主要成分",
    "comparedToPrevious": "前回比",
    "improvement": "改善",
    "disclaimer": "この分析結果は専門的な医療診断の代替ではなく、参考目的のみにご使用ください。"
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add messages/
git commit -m "feat: add Analyze and Results i18n strings for KO/EN/JA"
```

---

## Task 12: Camera + Upload Components

**Files:**
- Create: `src/components/analyze/CameraCapture.tsx`
- Create: `src/components/analyze/FileUpload.tsx`
- Create: `src/components/analyze/AnalyzeForm.tsx`

- [ ] **Step 1: Write failing test for CameraCapture**

Create `src/components/analyze/__tests__/CameraCapture.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CameraCapture } from '../CameraCapture'

// getUserMedia is not available in jsdom
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test:run -- src/components/analyze/__tests__/CameraCapture.test.tsx
```

Expected: FAIL — `Cannot find module '../CameraCapture'`

- [ ] **Step 3: Implement CameraCapture**

Create `src/components/analyze/CameraCapture.tsx`:

```tsx
'use client'

import { useRef, useState, useCallback, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Camera, RotateCcw } from 'lucide-react'

interface Props {
  onCapture: (blob: Blob) => void
  onError: (error: string) => void
}

export function CameraCapture({ onCapture, onError }: Props) {
  const t = useTranslations('Analyze')
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [isActive, setIsActive] = useState(false)
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user')

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1280 }, height: { ideal: 960 } },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        setIsActive(true)
      }
    } catch {
      onError(t('cameraError'))
    }
  }, [facingMode, onError, t])

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    setIsActive(false)
  }, [])

  const capture = useCallback(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d')!.drawImage(video, 0, 0)
    canvas.toBlob(
      (blob) => {
        if (blob) {
          stopCamera()
          onCapture(blob)
        }
      },
      'image/jpeg',
      0.92
    )
  }, [stopCamera, onCapture])

  const flipCamera = useCallback(() => {
    stopCamera()
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'))
  }, [stopCamera])

  useEffect(() => () => stopCamera(), [stopCamera])

  return (
    <div className="relative w-full max-w-md mx-auto">
      <div className="relative aspect-[3/4] bg-zinc-900 rounded-xl overflow-hidden">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
        />
        {isActive && (
          <>
            {/* Face guide oval */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-52 h-72 border-2 border-white/50 rounded-full" />
            </div>
            {/* Flip camera button */}
            <button
              onClick={flipCamera}
              className="absolute top-3 right-3 p-2 bg-black/40 rounded-full text-white"
              aria-label="Flip camera"
            >
              <RotateCcw className="w-5 h-5" />
            </button>
          </>
        )}
      </div>
      <canvas ref={canvasRef} className="hidden" />

      <div className="flex gap-3 mt-4 justify-center">
        {!isActive ? (
          <Button onClick={startCamera} size="lg" className="gap-2">
            <Camera className="w-4 h-4" />
            {t('startCamera')}
          </Button>
        ) : (
          <>
            <Button variant="outline" onClick={stopCamera}>
              {t('retake')}
            </Button>
            <Button onClick={capture} size="lg">
              {t('capturePhoto')}
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm run test:run -- src/components/analyze/__tests__/CameraCapture.test.tsx
```

Expected: `2 passed`

- [ ] **Step 5: Implement FileUpload**

Create `src/components/analyze/FileUpload.tsx`:

```tsx
'use client'

import { useRef } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Upload } from 'lucide-react'

interface Props {
  onFileSelected: (blob: Blob) => void
}

export function FileUpload({ onFileSelected }: Props) {
  const t = useTranslations('Analyze')
  const inputRef = useRef<HTMLInputElement>(null)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) onFileSelected(file)
    // Reset input so same file can be re-selected
    e.target.value = ''
  }

  return (
    <div className="text-center">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleChange}
      />
      <Button
        variant="outline"
        size="lg"
        className="gap-2"
        onClick={() => inputRef.current?.click()}
      >
        <Upload className="w-4 h-4" />
        {t('uploadPhoto')}
      </Button>
    </div>
  )
}
```

- [ ] **Step 6: Implement AnalyzeForm**

Create `src/components/analyze/AnalyzeForm.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { CameraCapture } from './CameraCapture'
import { FileUpload } from './FileUpload'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import Image from 'next/image'

interface Props {
  locale: string
  creditBalance: number
}

export function AnalyzeForm({ locale, creditBalance }: Props) {
  const t = useTranslations('Analyze')
  const router = useRouter()
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleCapture = (blob: Blob) => {
    setCapturedBlob(blob)
    setPreviewUrl(URL.createObjectURL(blob))
    setError(null)
  }

  const handleRetake = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setCapturedBlob(null)
    setPreviewUrl(null)
  }

  const handleSubmit = async () => {
    if (!capturedBlob) return
    if (creditBalance <= 0) {
      setError(t('insufficientCredits'))
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('image', capturedBlob, 'photo.jpg')
      formData.append('locale', locale)

      const res = await fetch('/api/analyze', { method: 'POST', body: formData })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Analysis request failed')
        return
      }

      router.push(`/${locale}/results/${data.analysis_id}`)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (previewUrl) {
    return (
      <div className="space-y-4">
        <div className="relative aspect-[3/4] w-full max-w-md mx-auto rounded-xl overflow-hidden bg-zinc-900">
          <Image src={previewUrl} alt="Preview" fill className="object-cover" />
        </div>
        {error && <p className="text-destructive text-sm text-center">{error}</p>}
        <div className="flex gap-3 justify-center">
          <Button variant="outline" onClick={handleRetake} disabled={isSubmitting}>
            {t('retake')}
          </Button>
          <Button onClick={handleSubmit} size="lg" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {t('analyzing')}
              </>
            ) : (
              t('startAnalysis')
            )}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <CameraCapture onCapture={handleCapture} onError={setError} />
      <div className="flex items-center gap-4">
        <div className="flex-1 border-t" />
        <span className="text-sm text-muted-foreground">{t('orDivider')}</span>
        <div className="flex-1 border-t" />
      </div>
      <FileUpload onFileSelected={handleCapture} />
      {error && <p className="text-destructive text-sm text-center">{error}</p>}
    </div>
  )
}
```

- [ ] **Step 7: Commit**

```bash
git add src/components/analyze/
git commit -m "feat: add CameraCapture, FileUpload, AnalyzeForm components"
```

---

## Task 13: Analyze Page

**Files:**
- Create: `src/app/[locale]/analyze/page.tsx`

- [ ] **Step 1: Write failing test**

Create `src/app/[locale]/analyze/__tests__/page.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { balance: 3 } }),
        }),
      }),
    }),
  }),
}))

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}))

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  getTranslations: vi.fn().mockResolvedValue((key: string) => key),
}))

vi.mock('@/components/analyze/AnalyzeForm', () => ({
  AnalyzeForm: ({ creditBalance }: { creditBalance: number }) => (
    <div data-testid="analyze-form" data-credits={creditBalance} />
  ),
}))

describe('Analyze page', () => {
  it('renders AnalyzeForm with credit balance', async () => {
    const AnalyzePage = (await import('../page')).default
    const jsx = await AnalyzePage({ params: Promise.resolve({ locale: 'ko' }) })
    render(jsx)
    const form = screen.getByTestId('analyze-form')
    expect(form).toBeInTheDocument()
    expect(form.getAttribute('data-credits')).toBe('3')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test:run -- src/app/\[locale\]/analyze/__tests__/page.test.tsx
```

Expected: FAIL — `Cannot find module '../page'`

- [ ] **Step 3: Implement analyze page**

Create `src/app/[locale]/analyze/page.tsx`:

```tsx
import { getTranslations } from 'next-intl/server'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AnalyzeForm } from '@/components/analyze/AnalyzeForm'

interface Props {
  params: Promise<{ locale: string }>
}

export default async function AnalyzePage({ params }: Props) {
  const { locale } = await params
  const t = await getTranslations('Analyze')
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}/auth/login`)

  const { data: credits } = await supabase
    .from('credits')
    .select('balance')
    .eq('user_id', user.id)
    .single()

  const creditBalance = credits?.balance ?? 0

  return (
    <main className="container max-w-lg mx-auto py-8 px-4">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold mb-2">{t('title')}</h1>
        <p className="text-muted-foreground">{t('subtitle')}</p>
        <p className="text-sm text-muted-foreground mt-1">{t('creditInfo')}</p>
      </div>

      <div className="bg-muted/30 rounded-xl p-4 mb-6 text-sm space-y-1">
        <p>✓ {t('guide1')}</p>
        <p>✓ {t('guide2')}</p>
        <p>✓ {t('guide3')}</p>
      </div>

      <AnalyzeForm locale={locale} creditBalance={creditBalance} />
    </main>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm run test:run -- src/app/\[locale\]/analyze/__tests__/page.test.tsx
```

Expected: `1 passed`

- [ ] **Step 5: Commit**

```bash
git add src/app/\[locale\]/analyze/
git commit -m "feat: add analyze page with auth guard and credit balance"
```

---

## Task 14: `useAnalysisStatus` Hook

**Files:**
- Create: `src/hooks/useAnalysisStatus.ts`
- Create: `src/hooks/__tests__/useAnalysisStatus.test.ts`

- [ ] **Step 1: Write failing test**

Create `src/hooks/__tests__/useAnalysisStatus.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const mockChannel = {
  on: vi.fn().mockReturnThis(),
  subscribe: vi.fn().mockReturnThis(),
}

const mockSupabase = {
  from: vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { status: 'validating' } }),
      }),
    }),
  }),
  channel: vi.fn().mockReturnValue(mockChannel),
  removeChannel: vi.fn(),
}

vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => mockSupabase),
}))

describe('useAnalysisStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockChannel.on.mockReturnThis()
    mockChannel.subscribe.mockReturnThis()
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { status: 'validating' } }),
        }),
      }),
    })
  })

  it('starts with pending status', () => {
    const { useAnalysisStatus } = require('../useAnalysisStatus')
    const { result } = renderHook(() => useAnalysisStatus('analysis-123'))
    expect(result.current.status).toBe('pending')
  })

  it('updates status from initial fetch', async () => {
    const { useAnalysisStatus } = require('../useAnalysisStatus')
    const { result } = renderHook(() => useAnalysisStatus('analysis-123'))
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })
    expect(result.current.status).toBe('validating')
  })

  it('subscribes to realtime channel', () => {
    const { useAnalysisStatus } = require('../useAnalysisStatus')
    renderHook(() => useAnalysisStatus('analysis-123'))
    expect(mockSupabase.channel).toHaveBeenCalledWith('analysis:analysis-123')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test:run -- src/hooks/__tests__/useAnalysisStatus.test.ts
```

Expected: FAIL — `Cannot find module '../useAnalysisStatus'`

- [ ] **Step 3: Implement hook**

Create `src/hooks/useAnalysisStatus.ts`:

```typescript
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { AnalysisStatus } from '@/lib/supabase/types'

interface AnalysisState {
  status: AnalysisStatus
}

export function useAnalysisStatus(analysisId: string): AnalysisState {
  const [state, setState] = useState<AnalysisState>({ status: 'pending' })

  useEffect(() => {
    const supabase = createClient()

    // Fetch current status immediately
    supabase
      .from('analyses')
      .select('status')
      .eq('id', analysisId)
      .single()
      .then(({ data }) => {
        if (data?.status) {
          setState({ status: data.status as AnalysisStatus })
        }
      })

    // Subscribe to Realtime changes
    const channel = supabase
      .channel(`analysis:${analysisId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'analyses',
          filter: `id=eq.${analysisId}`,
        },
        (payload) => {
          const status = payload.new.status as AnalysisStatus
          setState({ status })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [analysisId])

  return state
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm run test:run -- src/hooks/__tests__/useAnalysisStatus.test.ts
```

Expected: `3 passed`

- [ ] **Step 5: Commit**

```bash
git add src/hooks/
git commit -m "feat: add useAnalysisStatus hook with Supabase Realtime subscription"
```

---

## Task 15: Results Components

**Files:**
- Create: `src/components/results/AnalysisStatus.tsx`
- Create: `src/components/results/SkinScoreCard.tsx`
- Create: `src/components/results/RecommendationList.tsx`
- Create: `src/components/results/MedicalDisclaimer.tsx`

- [ ] **Step 1: Write failing test for AnalysisStatus**

Create `src/components/results/__tests__/AnalysisStatus.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AnalysisStatus } from '../AnalysisStatus'

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
    const { useAnalysisStatus } = require('@/hooks/useAnalysisStatus')
    ;(useAnalysisStatus as ReturnType<typeof vi.fn>).mockReturnValue({ status: 'failed' })
    render(<AnalysisStatus analysisId="analysis-123" locale="ko" />)
    expect(screen.getByText('분석에 실패했습니다')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test:run -- src/components/results/__tests__/AnalysisStatus.test.tsx
```

Expected: FAIL — `Cannot find module '../AnalysisStatus'`

- [ ] **Step 3: Implement AnalysisStatus**

Create `src/components/results/AnalysisStatus.tsx`:

```tsx
'use client'

import { useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useAnalysisStatus } from '@/hooks/useAnalysisStatus'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

interface Props {
  analysisId: string
  locale: string
}

const PROCESSING_MESSAGES_CYCLE = [
  'statusProcessing',
] as const

export function AnalysisStatus({ analysisId, locale }: Props) {
  const t = useTranslations('Results')
  const router = useRouter()
  const { status } = useAnalysisStatus(analysisId)

  useEffect(() => {
    if (status === 'completed') {
      router.refresh()
    }
  }, [status, router])

  if (status === 'failed') {
    return (
      <div className="text-center py-16 space-y-4">
        <div className="text-destructive text-5xl">✕</div>
        <h2 className="text-xl font-semibold">{t('failed')}</h2>
        <p className="text-muted-foreground max-w-xs mx-auto">{t('failedDescription')}</p>
        <Button asChild>
          <Link href={`/${locale}/analyze`}>{t('retryAnalysis')}</Link>
        </Button>
      </div>
    )
  }

  const messageKey =
    status === 'validating'
      ? 'statusValidating'
      : status === 'processing'
        ? 'statusProcessing'
        : 'statusPending'

  return (
    <div className="flex flex-col items-center py-16 gap-6">
      <Loader2 className="w-14 h-14 animate-spin text-primary" />
      <p className="text-lg text-muted-foreground">{t(messageKey)}</p>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm run test:run -- src/components/results/__tests__/AnalysisStatus.test.tsx
```

Expected: `2 passed`

- [ ] **Step 5: Implement SkinScoreCard**

Create `src/components/results/SkinScoreCard.tsx`:

```tsx
import { useTranslations } from 'next-intl'
import { Badge } from '@/components/ui/badge'
import type { Json } from '@/lib/supabase/types'

interface ComparisonData {
  overall_score?: number
  hydration_level?: number
}

interface Props {
  result: {
    skin_type: string | null
    overall_score: number | null
    hydration_level: number | null
    concerns: Json
    diagnosis_text: string | null
    comparison_data: Json | null
  }
}

function ScoreDelta({ value }: { value: number }) {
  if (value === 0) return null
  const positive = value > 0
  return (
    <span className={`text-sm font-medium ${positive ? 'text-green-500' : 'text-red-500'}`}>
      {positive ? '+' : ''}
      {value}
    </span>
  )
}

export function SkinScoreCard({ result }: Props) {
  const t = useTranslations('Results')
  const score = result.overall_score ?? 0
  const comparison = result.comparison_data as ComparisonData | null
  const concerns = (result.concerns as string[]) ?? []

  const scoreColor =
    score >= 70 ? 'text-green-500' : score >= 40 ? 'text-yellow-500' : 'text-red-500'

  return (
    <div className="space-y-6 mb-8">
      {/* Overall score */}
      <div className="text-center p-6 bg-muted/30 rounded-xl">
        <p className="text-sm text-muted-foreground mb-1">{t('skinScore')}</p>
        <div className="flex items-center justify-center gap-2">
          <span className={`text-7xl font-bold tabular-nums ${scoreColor}`}>{score}</span>
          <span className="text-muted-foreground text-2xl">/100</span>
        </div>
        {comparison?.overall_score != null && (
          <div className="mt-1 flex items-center justify-center gap-1 text-sm text-muted-foreground">
            <span>{t('comparedToPrevious')}</span>
            <ScoreDelta value={comparison.overall_score} />
          </div>
        )}
      </div>

      {/* Skin type + hydration */}
      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 bg-muted/30 rounded-xl text-center">
          <p className="text-xs text-muted-foreground mb-1">{t('skinType')}</p>
          <p className="font-semibold">{result.skin_type ?? '—'}</p>
        </div>
        <div className="p-4 bg-muted/30 rounded-xl text-center">
          <p className="text-xs text-muted-foreground mb-1">{t('hydrationLevel')}</p>
          <div className="flex items-center justify-center gap-1">
            <span className="font-semibold">{result.hydration_level ?? '—'}</span>
            <span className="text-muted-foreground text-xs">/10</span>
          </div>
          {comparison?.hydration_level != null && (
            <ScoreDelta value={comparison.hydration_level} />
          )}
        </div>
      </div>

      {/* Concerns */}
      {concerns.length > 0 && (
        <div>
          <p className="text-sm font-medium mb-2">{t('concerns')}</p>
          <div className="flex flex-wrap gap-2">
            {concerns.map((concern) => (
              <Badge key={concern} variant="secondary">
                {concern}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Diagnosis */}
      {result.diagnosis_text && (
        <div>
          <p className="text-sm font-medium mb-2">{t('diagnosis')}</p>
          <p className="text-sm text-muted-foreground leading-relaxed">{result.diagnosis_text}</p>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 6: Implement RecommendationList**

Create `src/components/results/RecommendationList.tsx`:

```tsx
import { useTranslations } from 'next-intl'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Json } from '@/lib/supabase/types'

interface Recommendation {
  category: string
  advice: string
  key_ingredients: string[]
}

interface Props {
  recommendations: Json
}

export function RecommendationList({ recommendations }: Props) {
  const t = useTranslations('Results')
  const items = (recommendations as Recommendation[]) ?? []

  if (items.length === 0) return null

  return (
    <div className="space-y-3 mb-8">
      <h2 className="text-base font-semibold">{t('recommendations')}</h2>
      {items.map((rec, idx) => (
        <Card key={idx}>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-medium">{rec.category}</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-2">
            <p className="text-sm text-muted-foreground">{rec.advice}</p>
            {rec.key_ingredients.length > 0 && (
              <div className="flex flex-wrap gap-1">
                <span className="text-xs text-muted-foreground mr-1">{t('keyIngredients')}:</span>
                {rec.key_ingredients.map((ing) => (
                  <Badge key={ing} variant="outline" className="text-xs">
                    {ing}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
```

- [ ] **Step 7: Implement MedicalDisclaimer**

Create `src/components/results/MedicalDisclaimer.tsx`:

```tsx
import { getTranslations } from 'next-intl/server'
import { AlertTriangle } from 'lucide-react'

interface Props {
  locale: string
}

export async function MedicalDisclaimer({ locale }: Props) {
  const t = await getTranslations({ locale, namespace: 'Results' })

  return (
    <div className="flex items-start gap-2 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-800 dark:text-amber-300">
      <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
      <p>{t('disclaimer')}</p>
    </div>
  )
}
```

- [ ] **Step 8: Commit**

```bash
git add src/components/results/
git commit -m "feat: add results components — status, score card, recommendations, disclaimer"
```

---

## Task 16: Results Page

**Files:**
- Create: `src/app/[locale]/results/[id]/page.tsx`

- [ ] **Step 1: Write failing test**

Create `src/app/[locale]/results/[id]/__tests__/page.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'analysis-1',
              user_id: 'user-1',
              status: 'processing',
              locale: 'ko',
              analysis_results: null,
            },
          }),
        }),
      }),
    }),
  }),
}))

vi.mock('next/navigation', () => ({ notFound: vi.fn() }))

vi.mock('@/components/results/AnalysisStatus', () => ({
  AnalysisStatus: ({ analysisId }: { analysisId: string }) => (
    <div data-testid="analysis-status" data-id={analysisId} />
  ),
}))

vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn().mockResolvedValue((key: string) => key),
}))

describe('Results page', () => {
  it('shows AnalysisStatus when analysis is still processing', async () => {
    const ResultsPage = (await import('../page')).default
    const jsx = await ResultsPage({
      params: Promise.resolve({ locale: 'ko', id: 'analysis-1' }),
    })
    render(jsx)
    expect(screen.getByTestId('analysis-status')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test:run -- "src/app/\[locale\]/results/\[id\]/__tests__/page.test.tsx"
```

Expected: FAIL — `Cannot find module '../page'`

- [ ] **Step 3: Implement results page**

Create `src/app/[locale]/results/[id]/page.tsx`:

```tsx
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AnalysisStatus } from '@/components/results/AnalysisStatus'
import { SkinScoreCard } from '@/components/results/SkinScoreCard'
import { RecommendationList } from '@/components/results/RecommendationList'
import { MedicalDisclaimer } from '@/components/results/MedicalDisclaimer'
import { getTranslations } from 'next-intl/server'

interface Props {
  params: Promise<{ locale: string; id: string }>
}

export default async function ResultsPage({ params }: Props) {
  const { locale, id } = await params
  const t = await getTranslations({ locale, namespace: 'Results' })
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: analysis } = await supabase
    .from('analyses')
    .select('*, analysis_results(*)')
    .eq('id', id)
    .single()

  if (!analysis || analysis.user_id !== user?.id) notFound()

  const result = (analysis.analysis_results as unknown[])?.[0] as
    | {
        skin_type: string | null
        overall_score: number | null
        hydration_level: number | null
        concerns: unknown
        diagnosis_text: string | null
        comparison_data: unknown
        recommendations: unknown
      }
    | undefined

  const isComplete = analysis.status === 'completed' && result != null

  return (
    <main className="container max-w-lg mx-auto py-8 px-4">
      {!isComplete ? (
        <AnalysisStatus analysisId={id} locale={locale} />
      ) : (
        <>
          <h1 className="text-xl font-bold text-center mb-6">{t('title')}</h1>
          <SkinScoreCard result={result} />
          <RecommendationList recommendations={result.recommendations} />
          <MedicalDisclaimer locale={locale} />
        </>
      )}
    </main>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm run test:run -- "src/app/\[locale\]/results/\[id\]/__tests__/page.test.tsx"
```

Expected: `1 passed`

- [ ] **Step 5: Run all Plan 2 tests**

```bash
npm run test:run
```

Expected: All tests pass. If any fail, fix them before continuing.

- [ ] **Step 6: Commit**

```bash
git add src/app/\[locale\]/results/
git commit -m "feat: add results page — conditional Realtime status or completed results"
```

---

## Task 17: End-to-End Smoke Test

No automated test — requires live Supabase + QStash + Anthropic credentials.

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

Expected: `http://localhost:3000` available, no build errors.

- [ ] **Step 2: Manual test — happy path**

1. Navigate to `http://localhost:3000/ko/analyze`
2. Expected: Camera/upload UI appears, credit balance shown in header
3. Upload any clear face photo (or use webcam)
4. Click "분석 시작"
5. Expected: Redirected to `/ko/results/<uuid>`
6. Expected: Loader appears with "얼굴을 인식하고 있습니다..." message
7. Expected: Within ~30 seconds, message changes to "피부 상태를 분석하고 있습니다..."
8. Expected: Page auto-refreshes showing skin score, type, concerns, recommendations, disclaimer
9. Verify in Supabase Dashboard → Table Editor → `analyses`: status = `completed`
10. Verify `analysis_results` table has a new row with scores and recommendations

- [ ] **Step 3: Manual test — validation failure**

1. Upload a photo that is NOT a face (e.g., a landscape or solid color)
2. Expected: Results page shows "분석에 실패했습니다" with retry button
3. Verify in `analyses` table: status = `failed`
4. Verify in `credits` table: balance unchanged (no deduction on validation failure)

- [ ] **Step 4: Manual test — insufficient credits**

1. In Supabase Dashboard → SQL Editor, run:
   ```sql
   UPDATE credits SET balance = 0 WHERE user_id = '<your-user-id>';
   ```
2. Navigate to `/ko/analyze`, upload a photo, click "분석 시작"
3. Expected: Error message "크레딧이 부족합니다" (no redirect to results)

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: complete Plan 2 Core Analysis pipeline end-to-end"
```

---

## Self-Review

### Spec coverage check

| Spec requirement | Covered by |
|---|---|
| Camera capture (`getUserMedia`) | Task 12 — `CameraCapture.tsx` |
| Desktop file upload fallback | Task 12 — `FileUpload.tsx` |
| Sharp image compression + thumbnail | Task 3 — `process.ts` |
| Supabase Storage upload (Signed URL) | Task 8 — `/api/analyze` |
| `analyses` record with status flow | Task 8 + Task 9 |
| Upstash QStash async queue | Task 8 (publish) + Task 9 (receive) |
| Haiku face validation (1-stage) | Task 5 — `validate-face.ts` |
| Sonnet skin analysis (2-stage) | Task 6 — `analyze-skin.ts` |
| Supabase Realtime status updates | Task 2 (migration), Task 14 (hook), Task 15 (component) |
| Credit deduction on success | Task 9 — worker |
| Credit refund on failure | Task 9 — worker |
| `comparison_data` calculation | Task 9 — worker |
| Original image deleted after 24h | Task 10 — cron route |
| Medical disclaimer (mandatory) | Task 15 — `MedicalDisclaimer.tsx` |
| 3-language i18n for Analyze/Results | Task 11 |
| Locale-specific AI output | Task 4 — `getAnalysisSystemPrompt(locale)` |

All spec requirements covered. No gaps found.

### Type consistency check

- `AnalysisStatus` type: defined in `src/lib/supabase/types.ts` (Plan 1), imported consistently across hook and components
- `Locale` type: defined in `src/lib/supabase/types.ts`, re-exported from `src/lib/ai/prompts.ts`
- `SkinAnalysisResult` from `prompts.ts` matches schema in `analyze-skin.ts` Zod validation
- `analysis_results` insert shape in worker matches `Database['public']['Tables']['analysis_results']['Insert']`

---

Plan complete and saved to `docs/superpowers/plans/2026-05-15-plan2-core-analysis.md`. Two execution options:

**1. Subagent-Driven (recommended)** — Fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
