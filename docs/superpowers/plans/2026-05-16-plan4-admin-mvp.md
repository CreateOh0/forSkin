# Admin MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin 전용 `/admin` 라우트 구축 — 유저 관리(검색·크레딧 조정·정지), Claude API 비용 모니터링, 오늘의 요약 카드.

**Architecture:** 2-레이어 보호(middleware 세션 guard + layout role guard). Server Components → Server Actions → Supabase Admin Client(서비스 롤). `analyses` 테이블에 토큰/비용 필드 추가, worker가 Claude 응답 후 기록.

**Tech Stack:** Next.js 16 App Router, Supabase JS v2, next-intl v4, shadcn/ui, Vitest + RTL

---

## File Map

**신규 생성:**
```
src/app/[locale]/admin/layout.tsx
src/app/[locale]/admin/page.tsx
src/app/[locale]/admin/users/page.tsx
src/app/[locale]/admin/costs/page.tsx
src/components/admin/AdminNav.tsx
src/components/admin/OverviewCards.tsx
src/components/admin/UserTable.tsx
src/components/admin/CreditAdjustModal.tsx
src/components/admin/SuspendConfirmDialog.tsx
src/components/admin/CostChart.tsx
src/components/admin/CostSummaryTable.tsx
src/components/admin/__tests__/UserTable.test.tsx
src/components/admin/__tests__/CreditAdjustModal.test.tsx
src/components/admin/__tests__/CostChart.test.tsx
src/actions/admin.ts
src/actions/__tests__/admin.test.ts
```

**수정:**
```
src/lib/supabase/types.ts          — analyses 3개 필드 + 'admin' transaction type
src/lib/ai/analyze-skin.ts         — usage 반환
src/lib/ai/validate-face.ts        — usage 반환
src/app/api/worker/analyze/route.ts — 비용 계산 + analyses 저장
middleware.ts                       — /admin 세션 guard
messages/ko.json
messages/en.json
messages/ja.json
```

---

## Task 1: DB 마이그레이션 — analyses 컬럼 + adjust_credit RPC

**Files:**
- Supabase SQL Editor에서 실행 (마이그레이션 파일 없음 — 직접 실행)

- [ ] **Step 1: Supabase SQL Editor에서 analyses 컬럼 추가**

```sql
ALTER TABLE analyses
  ADD COLUMN IF NOT EXISTS input_tokens       INT,
  ADD COLUMN IF NOT EXISTS output_tokens      INT,
  ADD COLUMN IF NOT EXISTS estimated_cost_usd NUMERIC(10,6);
```

- [ ] **Step 2: adjust_credit RPC 생성**

기존 `deduct_credit`, `refund_credit` 패턴과 동일.

```sql
CREATE OR REPLACE FUNCTION adjust_credit(
  p_user_id    UUID,
  p_delta      INT,        -- 양수=추가, 음수=차감
  p_admin_note TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- 잔액이 음수가 되지 않도록 체크
  IF p_delta < 0 THEN
    UPDATE credits
    SET balance = GREATEST(0, balance + p_delta)
    WHERE user_id = p_user_id;
  ELSE
    UPDATE credits
    SET balance = balance + p_delta
    WHERE user_id = p_user_id;
  END IF;

  INSERT INTO credit_transactions (user_id, amount, type, admin_note)
  VALUES (p_user_id, p_delta, 'admin', p_admin_note);
END;
$$;
```

> 주의: `type = 'admin'`은 Task 2에서 TypeScript 타입에 추가한다. DB enum이 있다면 `ALTER TYPE credit_transaction_type ADD VALUE 'admin';`도 실행.

---

## Task 2: TypeScript 타입 업데이트

**Files:**
- Modify: `src/lib/supabase/types.ts`

- [ ] **Step 1: CreditTransactionType에 'admin' 추가**

```typescript
// 변경 전
export type CreditTransactionType = 'signup' | 'purchase' | 'rating' | 'streak' | 'referral' | 'analysis' | 'refund'

// 변경 후
export type CreditTransactionType = 'signup' | 'purchase' | 'rating' | 'streak' | 'referral' | 'analysis' | 'refund' | 'admin'
```

- [ ] **Step 2: analyses Row에 3개 필드 추가**

`analyses.Row` 블록에 추가:
```typescript
input_tokens:       number | null
output_tokens:      number | null
estimated_cost_usd: number | null
```

- [ ] **Step 3: analyses Insert에 3개 필드 추가**

`analyses.Insert` 블록에 추가:
```typescript
input_tokens?:       number | null
output_tokens?:      number | null
estimated_cost_usd?: number | null
```

- [ ] **Step 4: analyses Update에 3개 필드 추가**

`analyses.Update` 블록에 추가:
```typescript
input_tokens?:       number | null
output_tokens?:      number | null
estimated_cost_usd?: number | null
```

- [ ] **Step 5: TypeScript 컴파일 확인**

```bash
npx tsc --noEmit
```

Expected: 에러 없음

- [ ] **Step 6: Commit**

```bash
git add src/lib/supabase/types.ts
git commit -m "feat: add token tracking fields and admin credit transaction type"
```

---

## Task 3: analyzeSkin — usage 반환

**Files:**
- Modify: `src/lib/ai/analyze-skin.ts`
- Modify: `src/lib/ai/__tests__/analyze-skin.test.ts`

- [ ] **Step 1: 기존 테스트 확인**

```bash
npx vitest run src/lib/ai/__tests__/analyze-skin.test.ts
```

Expected: PASS (기준선 확인)

- [ ] **Step 2: 반환 타입 변경 + usage 추가**

```typescript
export async function analyzeSkin(
  imageBase64: string,
  locale: Locale
): Promise<{ result: SkinAnalysisResult; usage: { input_tokens: number; output_tokens: number } }> {
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
  return {
    result: SkinAnalysisSchema.parse(parsed),
    usage: {
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
    },
  }
}
```

- [ ] **Step 3: 기존 테스트 mock에 usage 추가**

`src/lib/ai/__tests__/analyze-skin.test.ts`에서 mock response에 `usage` 필드 추가:

```typescript
// mock response 객체에 추가
usage: { input_tokens: 100, output_tokens: 200 },
```

그리고 반환값 검증을 `result.skin_type` 등으로 업데이트:

```typescript
// 기존: expect(result.skin_type).toBe(...)
// 변경: expect(result.result.skin_type).toBe(...)
expect(result.usage.input_tokens).toBe(100)
expect(result.usage.output_tokens).toBe(200)
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
npx vitest run src/lib/ai/__tests__/analyze-skin.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/analyze-skin.ts src/lib/ai/__tests__/analyze-skin.test.ts
git commit -m "feat: analyzeSkin returns token usage"
```

---

## Task 4: validateFace — usage 반환

**Files:**
- Modify: `src/lib/ai/validate-face.ts`
- Modify: `src/lib/ai/__tests__/validate-face.test.ts`

- [ ] **Step 1: 기존 테스트 확인**

```bash
npx vitest run src/lib/ai/__tests__/validate-face.test.ts
```

Expected: PASS

- [ ] **Step 2: 반환 타입 변경 + usage 추가**

```typescript
export async function validateFace(imageBase64: string): Promise<{
  result: FaceValidationResult
  usage: { input_tokens: number; output_tokens: number }
}> {
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
```

- [ ] **Step 3: 기존 테스트 mock에 usage 추가 + 반환값 업데이트**

```typescript
// mock response에 usage 추가
usage: { input_tokens: 50, output_tokens: 30 },

// 반환값 검증 업데이트
// 기존: expect(result.face_detected).toBe(true)
// 변경: expect(result.result.face_detected).toBe(true)
expect(result.usage.input_tokens).toBe(50)
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
npx vitest run src/lib/ai/__tests__/validate-face.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/validate-face.ts src/lib/ai/__tests__/validate-face.test.ts
git commit -m "feat: validateFace returns token usage"
```

---

## Task 5: Worker — 비용 계산 + analyses 저장

**Files:**
- Modify: `src/app/api/worker/analyze/route.ts`

- [ ] **Step 1: 기존 worker 테스트 확인**

```bash
npx vitest run src/app/api/worker
```

Expected: PASS (기준선)

- [ ] **Step 2: validateFace + analyzeSkin 호출 부분 수정**

`src/app/api/worker/analyze/route.ts` 전체 교체 (변경 부분만 표시):

파일 상단 `import` 변경 없음. 아래 로직만 수정.

`validateFace` 호출 부분:
```typescript
// 기존
const validation = await validateFace(imageBase64)
if (!validation.face_detected || !validation.quality_pass) { ... }

// 변경
const { result: validation, usage: validateUsage } = await validateFace(imageBase64)
if (!validation.face_detected || !validation.quality_pass) { ... }
```

`analyzeSkin` 호출 부분 (retry 포함):
```typescript
// 기존
let analysisResult
try {
  analysisResult = await analyzeSkin(imageBase64, analysis.locale as Locale)
} catch {
  try {
    analysisResult = await analyzeSkin(imageBase64, analysis.locale as Locale)
  } catch { ... }
}

// 변경
let analyzeResult: Awaited<ReturnType<typeof analyzeSkin>>
try {
  analyzeResult = await analyzeSkin(imageBase64, analysis.locale as Locale)
} catch {
  try {
    analyzeResult = await analyzeSkin(imageBase64, analysis.locale as Locale)
  } catch {
    await refundCredit(user_id, analysis_id, supabase)
    await updateStatus('failed')
    return NextResponse.json({ error: 'Analysis failed after retry' }, { status: 500 })
  }
}
const analysisResult = analyzeResult.result
const analyzeUsage = analyzeResult.usage
```

`analyzeSkin` import 뒤에 타입 import 추가:
```typescript
import type { analyzeSkin } from '@/lib/ai/analyze-skin'
```

- [ ] **Step 3: 비용 계산 + analyses 업데이트 수정**

기존 `await updateStatus('completed')` 를 아래로 교체:

```typescript
// Claude 가격 (USD per token, 2026-05 기준)
const PRICE = {
  SONNET_IN:  3.0  / 1_000_000,
  SONNET_OUT: 15.0 / 1_000_000,
  HAIKU_IN:   0.8  / 1_000_000,
  HAIKU_OUT:  4.0  / 1_000_000,
}

const estimated_cost_usd =
  analyzeUsage.input_tokens  * PRICE.SONNET_IN  +
  analyzeUsage.output_tokens * PRICE.SONNET_OUT +
  validateUsage.input_tokens * PRICE.HAIKU_IN   +
  validateUsage.output_tokens * PRICE.HAIKU_OUT

await supabase.from('analyses').update({
  status: 'completed',
  input_tokens: analyzeUsage.input_tokens,
  output_tokens: analyzeUsage.output_tokens,
  estimated_cost_usd,
}).eq('id', analysis_id)
```

`updateStatus('completed')` 호출 제거 (위 update가 status도 설정하므로).

- [ ] **Step 4: worker 테스트 mock 업데이트**

`src/app/api/worker/__tests__/*.test.ts` (또는 관련 파일)에서 `validateFace`와 `analyzeSkin` mock을 새 반환 형태로 업데이트:

```typescript
vi.mock('@/lib/ai/validate-face', () => ({
  validateFace: vi.fn().mockResolvedValue({
    result: { face_detected: true, quality_pass: true, issues: [] },
    usage: { input_tokens: 50, output_tokens: 30 },
  }),
}))

vi.mock('@/lib/ai/analyze-skin', () => ({
  analyzeSkin: vi.fn().mockResolvedValue({
    result: {
      skin_type: 'normal',
      hydration_level: 7,
      overall_score: 75,
      concerns: [],
      diagnosis: 'test',
      recommendations: [{ category: 'hydration', advice: 'drink water', key_ingredients: [] }],
    },
    usage: { input_tokens: 1000, output_tokens: 500 },
  }),
}))
```

- [ ] **Step 5: 전체 테스트 통과 확인**

```bash
npx vitest run
```

Expected: 51개 이상 PASS

- [ ] **Step 6: Commit**

```bash
git add src/app/api/worker/analyze/route.ts
git commit -m "feat: worker tracks Claude token usage and estimated cost"
```

---

## Task 6: Admin Server Actions (TDD)

**Files:**
- Create: `src/actions/admin.ts`
- Create: `src/actions/__tests__/admin.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

```typescript
// src/actions/__tests__/admin.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockRpc = vi.fn()
const mockFrom = vi.fn()
const mockAdminUsers = { updateUserById: vi.fn() }
const mockAdminSupabase = {
  from: mockFrom,
  rpc: mockRpc,
  auth: { getUser: vi.fn(), admin: mockAdminUsers },
}
const mockUserSupabase = {
  auth: { getUser: vi.fn() },
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => Promise.resolve(mockUserSupabase)),
}))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => mockAdminSupabase),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { adjustCredit, setSuspension, getUsers, getAdminOverview, getCostData } from '../admin'

describe('adjustCredit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUserSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'admin-1' } } })
    mockAdminSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'admin-1' } } })
    const mockSelect = vi.fn().mockReturnThis()
    const mockEq = vi.fn().mockReturnThis()
    const mockSingle = vi.fn().mockResolvedValue({ data: { role: 'admin' }, error: null })
    mockFrom.mockReturnValue({ select: mockSelect, eq: mockEq, single: mockSingle })
    mockSelect.mockReturnThis()
    mockEq.mockReturnThis()
  })

  it('calls adjust_credit RPC with correct params', async () => {
    mockRpc.mockResolvedValue({ error: null })
    const result = await adjustCredit('user-1', 5, '테스트 지급')
    expect(mockRpc).toHaveBeenCalledWith('adjust_credit', {
      p_user_id: 'user-1',
      p_delta: 5,
      p_admin_note: '테스트 지급',
    })
    expect(result).toEqual({})
  })

  it('returns error when not admin', async () => {
    const mockSelect = vi.fn().mockReturnThis()
    const mockEq = vi.fn().mockReturnThis()
    const mockSingle = vi.fn().mockResolvedValue({ data: { role: 'user' }, error: null })
    mockFrom.mockReturnValue({ select: mockSelect, eq: mockEq, single: mockSingle })
    mockSelect.mockReturnThis()
    mockEq.mockReturnThis()
    const result = await adjustCredit('user-1', 5, 'note')
    expect(result).toEqual({ error: 'Unauthorized' })
  })

  it('returns error when RPC fails', async () => {
    mockRpc.mockResolvedValue({ error: { message: 'rpc error' } })
    const result = await adjustCredit('user-1', 5, 'note')
    expect(result).toEqual({ error: 'rpc error' })
  })
})

describe('setSuspension', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUserSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'admin-1' } } })
    mockAdminSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'admin-1' } } })
    const mockSelect = vi.fn().mockReturnThis()
    const mockEq = vi.fn().mockReturnThis()
    const mockSingle = vi.fn().mockResolvedValue({ data: { role: 'admin' }, error: null })
    mockFrom.mockReturnValue({ select: mockSelect, eq: mockEq, single: mockSingle })
    mockSelect.mockReturnThis()
    mockEq.mockReturnThis()
  })

  it('bans user with 876000h duration', async () => {
    mockAdminUsers.updateUserById.mockResolvedValue({ error: null })
    const result = await setSuspension('user-1', true)
    expect(mockAdminUsers.updateUserById).toHaveBeenCalledWith('user-1', { ban_duration: '876000h' })
    expect(result).toEqual({})
  })

  it('unbans user with none duration', async () => {
    mockAdminUsers.updateUserById.mockResolvedValue({ error: null })
    const result = await setSuspension('user-1', false)
    expect(mockAdminUsers.updateUserById).toHaveBeenCalledWith('user-1', { ban_duration: 'none' })
    expect(result).toEqual({})
  })
})
```

- [ ] **Step 2: 테스트 실행 → FAIL 확인**

```bash
npx vitest run src/actions/__tests__/admin.test.ts
```

Expected: FAIL ("Cannot find module '../admin'")

- [ ] **Step 3: admin.ts 구현**

```typescript
// src/actions/admin.ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

async function requireAdmin(): Promise<{ userId: string } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const adminSupabase = createAdminClient()
  const { data: profile } = await adminSupabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') return { error: 'Unauthorized' }
  return { userId: user.id }
}

export async function adjustCredit(
  userId: string,
  delta: number,
  note: string
): Promise<{ error?: string }> {
  const auth = await requireAdmin()
  if ('error' in auth) return auth

  const supabase = createAdminClient()
  const { error } = await supabase.rpc('adjust_credit', {
    p_user_id: userId,
    p_delta: delta,
    p_admin_note: note,
  })

  if (error) return { error: error.message }
  revalidatePath('/', 'layout')
  return {}
}

export async function setSuspension(
  userId: string,
  banned: boolean
): Promise<{ error?: string }> {
  const auth = await requireAdmin()
  if ('error' in auth) return auth

  const supabase = createAdminClient()
  const { error } = await supabase.auth.admin.updateUserById(userId, {
    ban_duration: banned ? '876000h' : 'none',
  })

  if (error) return { error: error.message }
  revalidatePath('/', 'layout')
  return {}
}

export type AdminUser = {
  id: string
  email: string
  name: string | null
  role: string
  created_at: string
  balance: number
  banned_until: string | null
}

export async function getUsers(
  search?: string,
  page = 0
): Promise<{ users: AdminUser[]; total: number; error?: string }> {
  const auth = await requireAdmin()
  if ('error' in auth) return { users: [], total: 0, error: (auth as { error: string }).error }

  const supabase = createAdminClient()
  const pageSize = 10
  const from = page * pageSize
  const to = from + pageSize - 1

  let query = supabase
    .from('users')
    .select('id, email, name, role, created_at', { count: 'exact' })
    .range(from, to)
    .order('created_at', { ascending: false })

  if (search) {
    query = query.ilike('email', `%${search}%`)
  }

  const { data: users, count, error } = await query
  if (error) return { users: [], total: 0, error: error.message }

  const userIds = (users ?? []).map(u => u.id)
  const { data: credits } = await supabase
    .from('credits')
    .select('user_id, balance')
    .in('user_id', userIds)

  const balanceMap = Object.fromEntries((credits ?? []).map(c => [c.user_id, c.balance]))

  // banned_until: Supabase Auth admin listUsers
  const { data: authList } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const bannedMap = Object.fromEntries(
    (authList?.users ?? []).map(u => [u.id, u.banned_until ?? null])
  )

  const result: AdminUser[] = (users ?? []).map(u => ({
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    created_at: u.created_at,
    balance: balanceMap[u.id] ?? 0,
    banned_until: bannedMap[u.id] ?? null,
  }))

  return { users: result, total: count ?? 0 }
}

export type OverviewData = {
  todayAnalyses: number
  todayCost: number
  newUsers: number
}

export async function getAdminOverview(): Promise<OverviewData> {
  const auth = await requireAdmin()
  if ('error' in auth) return { todayAnalyses: 0, todayCost: 0, newUsers: 0 }

  const supabase = createAdminClient()
  const todayStart = new Date()
  todayStart.setUTCHours(0, 0, 0, 0)
  const todayISO = todayStart.toISOString()

  const { data: analyses } = await supabase
    .from('analyses')
    .select('estimated_cost_usd')
    .eq('status', 'completed')
    .gte('created_at', todayISO)

  const todayAnalyses = analyses?.length ?? 0
  const todayCost = (analyses ?? []).reduce((sum, a) => sum + (a.estimated_cost_usd ?? 0), 0)

  const { data: users } = await supabase
    .from('users')
    .select('id', { count: 'exact' })
    .gte('created_at', todayISO)

  const newUsers = users?.length ?? 0

  return { todayAnalyses, todayCost, newUsers }
}

export type CostDataPoint = {
  date: string          // YYYY-MM-DD
  call_count: number
  input_tokens: number
  output_tokens: number
  estimated_cost_usd: number
}

export async function getCostData(
  period: 'day' | 'week'
): Promise<CostDataPoint[]> {
  const auth = await requireAdmin()
  if ('error' in auth) return []

  const supabase = createAdminClient()
  const days = period === 'day' ? 1 : 7
  const since = new Date()
  since.setDate(since.getDate() - days)

  const { data } = await supabase
    .from('analyses')
    .select('created_at, input_tokens, output_tokens, estimated_cost_usd')
    .eq('status', 'completed')
    .gte('created_at', since.toISOString())
    .order('created_at', { ascending: true })

  // 날짜별 집계
  const byDate: Record<string, CostDataPoint> = {}
  for (const row of data ?? []) {
    const date = row.created_at.slice(0, 10)
    if (!byDate[date]) {
      byDate[date] = { date, call_count: 0, input_tokens: 0, output_tokens: 0, estimated_cost_usd: 0 }
    }
    byDate[date].call_count++
    byDate[date].input_tokens  += row.input_tokens  ?? 0
    byDate[date].output_tokens += row.output_tokens ?? 0
    byDate[date].estimated_cost_usd += row.estimated_cost_usd ?? 0
  }

  return Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date))
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
npx vitest run src/actions/__tests__/admin.test.ts
```

Expected: PASS

- [ ] **Step 5: 전체 테스트 통과 확인**

```bash
npx vitest run
```

Expected: 전체 PASS

- [ ] **Step 6: Commit**

```bash
git add src/actions/admin.ts src/actions/__tests__/admin.test.ts
git commit -m "feat: admin server actions (credit adjust, suspend, users, costs)"
```

---

## Task 7: Middleware + Admin Layout

**Files:**
- Modify: `middleware.ts`
- Create: `src/app/[locale]/admin/layout.tsx`

- [ ] **Step 1: middleware.ts에 /admin 세션 guard 추가**

```typescript
// middleware.ts
import createMiddleware from 'next-intl/middleware'
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { updateSession } from '@/lib/supabase/middleware'
import { locales, defaultLocale } from '@/lib/i18n/request'

const intlMiddleware = createMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'always',
})

export async function middleware(request: NextRequest) {
  const response = intlMiddleware(request)

  // /[locale]/admin/** — 세션 없으면 login으로
  const pathname = request.nextUrl.pathname
  if (/^\/[a-z]{2}\/admin(\/|$)/.test(pathname)) {
    const locale = pathname.split('/')[1] ?? defaultLocale

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => request.cookies.getAll(),
          setAll: () => {},
        },
      }
    )
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.redirect(
        new URL(`/${locale}/auth/login`, request.url)
      )
    }
  }

  return updateSession(request, response as NextResponse)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
}
```

- [ ] **Step 2: admin layout.tsx 생성 (role guard)**

```typescript
// src/app/[locale]/admin/layout.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { AdminNav } from '@/components/admin/AdminNav'

interface Props {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}

export default async function AdminLayout({ children, params }: Props) {
  const { locale } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}/auth/login`)

  const adminSupabase = createAdminClient()
  const { data: profile } = await adminSupabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') redirect(`/${locale}/dashboard`)

  return (
    <div className="flex min-h-screen">
      <AdminNav locale={locale} />
      <main className="flex-1 p-8">{children}</main>
    </div>
  )
}
```

- [ ] **Step 3: 빌드 확인**

```bash
npx tsc --noEmit
```

Expected: 에러 없음

- [ ] **Step 4: Commit**

```bash
git add middleware.ts src/app/[locale]/admin/layout.tsx
git commit -m "feat: admin route protection (middleware session + layout role guard)"
```

---

## Task 8: i18n 키 추가

**Files:**
- Modify: `messages/ko.json`
- Modify: `messages/en.json`
- Modify: `messages/ja.json`

- [ ] **Step 1: ko.json에 Admin 섹션 추가**

최상위 객체에 추가:
```json
"Admin": {
  "overview": "개요",
  "users": "사용자 관리",
  "costs": "비용 모니터링",
  "todayAnalyses": "오늘 분석",
  "todayCost": "오늘 비용 (USD)",
  "newUsers": "신규 유저",
  "search": "이메일로 검색",
  "searchPlaceholder": "user@example.com",
  "adjust": "크레딧 조정",
  "suspend": "정지",
  "unsuspend": "정지 해제",
  "creditDelta": "조정량 (양수=추가, 음수=차감)",
  "note": "사유",
  "confirm": "확인",
  "cancel": "취소",
  "balance": "잔액",
  "status": "상태",
  "active": "정상",
  "suspended": "정지됨",
  "periodDay": "일별",
  "periodWeek": "주별",
  "callCount": "API 호출",
  "estimatedCost": "추정 비용 (USD)",
  "inputTokens": "Input 토큰",
  "outputTokens": "Output 토큰",
  "noData": "데이터 없음",
  "suspendConfirmTitle": "유저 정지",
  "suspendConfirmDesc": "이 유저의 로그인을 차단합니다. 언제든 해제할 수 있습니다.",
  "unsuspendConfirmTitle": "정지 해제",
  "unsuspendConfirmDesc": "이 유저의 접근을 복구합니다.",
  "creditAdjustTitle": "크레딧 조정",
  "adjustSuccess": "조정 완료",
  "adjustError": "조정 실패"
}
```

- [ ] **Step 2: en.json에 Admin 섹션 추가**

```json
"Admin": {
  "overview": "Overview",
  "users": "User Management",
  "costs": "Cost Monitoring",
  "todayAnalyses": "Today's Analyses",
  "todayCost": "Today's Cost (USD)",
  "newUsers": "New Users",
  "search": "Search by email",
  "searchPlaceholder": "user@example.com",
  "adjust": "Adjust Credits",
  "suspend": "Suspend",
  "unsuspend": "Unsuspend",
  "creditDelta": "Amount (positive=add, negative=deduct)",
  "note": "Reason",
  "confirm": "Confirm",
  "cancel": "Cancel",
  "balance": "Balance",
  "status": "Status",
  "active": "Active",
  "suspended": "Suspended",
  "periodDay": "Daily",
  "periodWeek": "Weekly",
  "callCount": "API Calls",
  "estimatedCost": "Estimated Cost (USD)",
  "inputTokens": "Input Tokens",
  "outputTokens": "Output Tokens",
  "noData": "No data",
  "suspendConfirmTitle": "Suspend User",
  "suspendConfirmDesc": "This will block the user from logging in. You can unsuspend at any time.",
  "unsuspendConfirmTitle": "Unsuspend User",
  "unsuspendConfirmDesc": "This will restore the user's access.",
  "creditAdjustTitle": "Adjust Credits",
  "adjustSuccess": "Adjustment complete",
  "adjustError": "Adjustment failed"
}
```

- [ ] **Step 3: ja.json에 Admin 섹션 추가**

```json
"Admin": {
  "overview": "概要",
  "users": "ユーザー管理",
  "costs": "コスト監視",
  "todayAnalyses": "今日の分析",
  "todayCost": "今日のコスト (USD)",
  "newUsers": "新規ユーザー",
  "search": "メールで検索",
  "searchPlaceholder": "user@example.com",
  "adjust": "クレジット調整",
  "suspend": "停止",
  "unsuspend": "停止解除",
  "creditDelta": "調整量（正=追加、負=差引）",
  "note": "理由",
  "confirm": "確認",
  "cancel": "キャンセル",
  "balance": "残高",
  "status": "ステータス",
  "active": "正常",
  "suspended": "停止中",
  "periodDay": "日別",
  "periodWeek": "週別",
  "callCount": "API呼び出し",
  "estimatedCost": "推定コスト (USD)",
  "inputTokens": "Inputトークン",
  "outputTokens": "Outputトークン",
  "noData": "データなし",
  "suspendConfirmTitle": "ユーザー停止",
  "suspendConfirmDesc": "このユーザーのログインをブロックします。いつでも解除できます。",
  "unsuspendConfirmTitle": "停止解除",
  "unsuspendConfirmDesc": "このユーザーのアクセスを復元します。",
  "creditAdjustTitle": "クレジット調整",
  "adjustSuccess": "調整完了",
  "adjustError": "調整失敗"
}
```

- [ ] **Step 4: Commit**

```bash
git add messages/ko.json messages/en.json messages/ja.json
git commit -m "feat: add Admin i18n strings (ko/en/ja)"
```

---

## Task 9: AdminNav + OverviewCards + Overview 페이지

**Files:**
- Create: `src/components/admin/AdminNav.tsx`
- Create: `src/components/admin/OverviewCards.tsx`
- Create: `src/app/[locale]/admin/page.tsx`

- [ ] **Step 1: AdminNav.tsx 생성**

```typescript
// src/components/admin/AdminNav.tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'

interface Props { locale: string }

export function AdminNav({ locale }: Props) {
  const t = useTranslations('Admin')
  const pathname = usePathname()

  const links = [
    { href: `/${locale}/admin`,        label: t('overview') },
    { href: `/${locale}/admin/users`,  label: t('users') },
    { href: `/${locale}/admin/costs`,  label: t('costs') },
  ]

  return (
    <nav className="w-48 bg-muted border-r p-4 flex flex-col gap-1">
      <p className="text-xs font-semibold text-muted-foreground uppercase mb-3">Admin</p>
      {links.map(link => (
        <Link
          key={link.href}
          href={link.href}
          className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
            pathname === link.href
              ? 'bg-primary text-primary-foreground'
              : 'hover:bg-accent'
          }`}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  )
}
```

- [ ] **Step 2: OverviewCards.tsx 생성**

```typescript
// src/components/admin/OverviewCards.tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getTranslations } from 'next-intl/server'
import type { OverviewData } from '@/actions/admin'

interface Props {
  data: OverviewData
  locale: string
}

export async function OverviewCards({ data, locale }: Props) {
  const t = await getTranslations({ locale, namespace: 'Admin' })

  const cards = [
    { label: t('todayAnalyses'), value: data.todayAnalyses.toString() },
    { label: t('todayCost'),     value: `$${data.todayCost.toFixed(4)}` },
    { label: t('newUsers'),      value: data.newUsers.toString() },
  ]

  return (
    <div className="grid grid-cols-3 gap-4 mb-8">
      {cards.map(card => (
        <Card key={card.label}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {card.label}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{card.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: admin/page.tsx 생성**

```typescript
// src/app/[locale]/admin/page.tsx
import { getTranslations } from 'next-intl/server'
import { getAdminOverview } from '@/actions/admin'
import { OverviewCards } from '@/components/admin/OverviewCards'

interface Props { params: Promise<{ locale: string }> }

export default async function AdminOverviewPage({ params }: Props) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'Admin' })
  const data = await getAdminOverview()

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">{t('overview')}</h1>
      <OverviewCards data={data} locale={locale} />
    </div>
  )
}
```

- [ ] **Step 4: 빌드 확인**

```bash
npx tsc --noEmit
```

Expected: 에러 없음

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/AdminNav.tsx src/components/admin/OverviewCards.tsx \
  src/app/[locale]/admin/page.tsx
git commit -m "feat: admin overview page with stat cards"
```

---

## Task 10: UserTable + CreditAdjustModal + SuspendConfirmDialog + Users 페이지

**Files:**
- Create: `src/components/admin/UserTable.tsx`
- Create: `src/components/admin/CreditAdjustModal.tsx`
- Create: `src/components/admin/SuspendConfirmDialog.tsx`
- Create: `src/app/[locale]/admin/users/page.tsx`

- [ ] **Step 1: 실패하는 테스트 작성**

```typescript
// src/components/admin/__tests__/UserTable.test.tsx
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
```

- [ ] **Step 2: 테스트 실행 → FAIL 확인**

```bash
npx vitest run src/components/admin/__tests__/UserTable.test.tsx
```

Expected: FAIL

- [ ] **Step 3: CreditAdjustModal.tsx 생성**

```typescript
// src/components/admin/CreditAdjustModal.tsx
'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { adjustCredit } from '@/actions/admin'

interface Props {
  userId: string
  userName: string | null
  open: boolean
  onClose: () => void
}

export function CreditAdjustModal({ userId, userName, open, onClose }: Props) {
  const t = useTranslations('Admin')
  const [delta, setDelta] = useState('')
  const [note, setNote]   = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    const parsed = parseInt(delta, 10)
    if (isNaN(parsed) || parsed === 0) return
    setLoading(true)
    setError(null)
    const result = await adjustCredit(userId, parsed, note)
    setLoading(false)
    if (result.error) {
      setError(result.error)
    } else {
      setDelta('')
      setNote('')
      onClose()
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('creditAdjustTitle')} — {userName ?? userId}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label>{t('creditDelta')}</Label>
            <Input
              type="number"
              value={delta}
              onChange={e => setDelta(e.target.value)}
              placeholder="+5 or -3"
            />
          </div>
          <div className="grid gap-2">
            <Label>{t('note')}</Label>
            <Input
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder={t('note')}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t('cancel')}</Button>
          <Button onClick={handleSubmit} disabled={loading || !delta}>
            {t('confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 4: SuspendConfirmDialog.tsx 생성**

```typescript
// src/components/admin/SuspendConfirmDialog.tsx
'use client'

import { useTranslations } from 'next-intl'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { setSuspension } from '@/actions/admin'

interface Props {
  userId: string
  banned: boolean           // 현재 정지 상태
  open: boolean
  onClose: () => void
}

export function SuspendConfirmDialog({ userId, banned, open, onClose }: Props) {
  const t = useTranslations('Admin')

  const handleConfirm = async () => {
    await setSuspension(userId, !banned)
    onClose()
  }

  return (
    <AlertDialog open={open} onOpenChange={v => !v && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {banned ? t('unsuspendConfirmTitle') : t('suspendConfirmTitle')}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {banned ? t('unsuspendConfirmDesc') : t('suspendConfirmDesc')}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm}>{t('confirm')}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
```

- [ ] **Step 5: UserTable.tsx 생성**

```typescript
// src/components/admin/UserTable.tsx
'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { CreditAdjustModal } from './CreditAdjustModal'
import { SuspendConfirmDialog } from './SuspendConfirmDialog'
import type { AdminUser } from '@/actions/admin'

interface Props {
  users: AdminUser[]
  total: number
  locale: string
}

export function UserTable({ users, total, locale }: Props) {
  const t = useTranslations('Admin')
  const router = useRouter()
  const searchParams = useSearchParams()
  const [search, setSearch] = useState(searchParams.get('search') ?? '')
  const [creditTarget, setCreditTarget] = useState<AdminUser | null>(null)
  const [suspendTarget, setSuspendTarget] = useState<AdminUser | null>(null)

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const params = new URLSearchParams(searchParams)
    if (search) params.set('search', search)
    else params.delete('search')
    params.delete('page')
    router.push(`?${params.toString()}`)
  }

  const page = parseInt(searchParams.get('page') ?? '0', 10)

  const handlePage = (next: number) => {
    const params = new URLSearchParams(searchParams)
    params.set('page', next.toString())
    router.push(`?${params.toString()}`)
  }

  if (users.length === 0 && !search) {
    return <p className="text-muted-foreground">{t('noData')}</p>
  }

  return (
    <div>
      <form onSubmit={handleSearch} className="flex gap-2 mb-4">
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={t('searchPlaceholder')}
          className="max-w-xs"
        />
        <Button type="submit" variant="outline">{t('search')}</Button>
      </form>

      {users.length === 0 ? (
        <p className="text-muted-foreground">{t('noData')}</p>
      ) : (
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2 pr-4">Email</th>
              <th className="text-left py-2 pr-4">Name</th>
              <th className="text-right py-2 pr-4">{t('balance')}</th>
              <th className="text-left py-2 pr-4">{t('status')}</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody>
            {users.map(user => {
              const isBanned = !!user.banned_until
              return (
                <tr key={user.id} className="border-b hover:bg-muted/50">
                  <td className="py-2 pr-4">{user.email}</td>
                  <td className="py-2 pr-4">{user.name ?? '—'}</td>
                  <td className="py-2 pr-4 text-right font-mono">{user.balance}</td>
                  <td className="py-2 pr-4">
                    <Badge variant={isBanned ? 'destructive' : 'secondary'}>
                      {isBanned ? t('suspended') : t('active')}
                    </Badge>
                  </td>
                  <td className="py-2 flex gap-2 justify-end">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setCreditTarget(user)}
                    >
                      {t('adjust')}
                    </Button>
                    <Button
                      size="sm"
                      variant={isBanned ? 'default' : 'destructive'}
                      onClick={() => setSuspendTarget(user)}
                    >
                      {isBanned ? t('unsuspend') : t('suspend')}
                    </Button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}

      <div className="flex justify-between items-center mt-4">
        <p className="text-sm text-muted-foreground">Total: {total}</p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" disabled={page === 0} onClick={() => handlePage(page - 1)}>
            Prev
          </Button>
          <Button size="sm" variant="outline" disabled={(page + 1) * 10 >= total} onClick={() => handlePage(page + 1)}>
            Next
          </Button>
        </div>
      </div>

      {creditTarget && (
        <CreditAdjustModal
          userId={creditTarget.id}
          userName={creditTarget.name}
          open
          onClose={() => setCreditTarget(null)}
        />
      )}
      {suspendTarget && (
        <SuspendConfirmDialog
          userId={suspendTarget.id}
          banned={!!suspendTarget.banned_until}
          open
          onClose={() => setSuspendTarget(null)}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 6: 테스트 통과 확인**

```bash
npx vitest run src/components/admin/__tests__/UserTable.test.tsx
```

Expected: PASS

- [ ] **Step 7: admin/users/page.tsx 생성**

```typescript
// src/app/[locale]/admin/users/page.tsx
import { getTranslations } from 'next-intl/server'
import { getUsers } from '@/actions/admin'
import { UserTable } from '@/components/admin/UserTable'

interface Props {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ search?: string; page?: string }>
}

export default async function AdminUsersPage({ params, searchParams }: Props) {
  const { locale } = await params
  const { search, page } = await searchParams
  const t = await getTranslations({ locale, namespace: 'Admin' })

  const { users, total } = await getUsers(search, page ? parseInt(page, 10) : 0)

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">{t('users')}</h1>
      <UserTable users={users} total={total} locale={locale} />
    </div>
  )
}
```

- [ ] **Step 8: CreditAdjustModal 테스트**

```typescript
// src/components/admin/__tests__/CreditAdjustModal.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))
vi.mock('@/actions/admin', () => ({
  adjustCredit: vi.fn().mockResolvedValue({}),
}))

import { CreditAdjustModal } from '../CreditAdjustModal'
import { adjustCredit } from '@/actions/admin'

describe('CreditAdjustModal', () => {
  it('calls adjustCredit with parsed delta on submit', async () => {
    const user = userEvent.setup()
    render(
      <CreditAdjustModal userId="u1" userName="Alice" open onClose={vi.fn()} />
    )
    await user.clear(screen.getByRole('spinbutton'))
    await user.type(screen.getByRole('spinbutton'), '5')
    await user.type(screen.getByPlaceholderText('note'), '테스트')
    await user.click(screen.getByText('confirm'))
    expect(adjustCredit).toHaveBeenCalledWith('u1', 5, '테스트')
  })

  it('does not submit when delta is empty', async () => {
    const user = userEvent.setup()
    render(
      <CreditAdjustModal userId="u1" userName="Alice" open onClose={vi.fn()} />
    )
    await user.click(screen.getByText('confirm'))
    expect(adjustCredit).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 9: 전체 테스트 통과 확인**

```bash
npx vitest run
```

Expected: 전체 PASS

- [ ] **Step 10: Commit**

```bash
git add src/components/admin/UserTable.tsx src/components/admin/CreditAdjustModal.tsx \
  src/components/admin/SuspendConfirmDialog.tsx \
  src/app/[locale]/admin/users/page.tsx \
  src/components/admin/__tests__/UserTable.test.tsx \
  src/components/admin/__tests__/CreditAdjustModal.test.tsx
git commit -m "feat: admin users page with credit adjust and suspend"
```

---

## Task 11: CostChart + CostSummaryTable + Costs 페이지

**Files:**
- Create: `src/components/admin/CostChart.tsx`
- Create: `src/components/admin/CostSummaryTable.tsx`
- Create: `src/app/[locale]/admin/costs/page.tsx`
- Create: `src/components/admin/__tests__/CostChart.test.tsx`

- [ ] **Step 1: 실패하는 CostChart 테스트 작성**

```typescript
// src/components/admin/__tests__/CostChart.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

import { CostChart } from '../CostChart'
import type { CostDataPoint } from '@/actions/admin'

const mockData: CostDataPoint[] = [
  { date: '2026-05-14', call_count: 5, input_tokens: 5000, output_tokens: 2000, estimated_cost_usd: 0.015 },
  { date: '2026-05-15', call_count: 8, input_tokens: 8000, output_tokens: 3000, estimated_cost_usd: 0.024 },
  { date: '2026-05-16', call_count: 3, input_tokens: 3000, output_tokens: 1000, estimated_cost_usd: 0.009 },
]

describe('CostChart', () => {
  it('renders SVG when data present', () => {
    const { container } = render(<CostChart data={mockData} />)
    expect(container.querySelector('svg')).toBeInTheDocument()
  })

  it('renders polyline when data has multiple points', () => {
    const { container } = render(<CostChart data={mockData} />)
    expect(container.querySelector('polyline')).toBeInTheDocument()
  })

  it('shows noData when empty', () => {
    render(<CostChart data={[]} />)
    expect(screen.getByText('noData')).toBeInTheDocument()
  })

  it('renders period buttons', () => {
    render(<CostChart data={mockData} />)
    expect(screen.getByText('periodDay')).toBeInTheDocument()
    expect(screen.getByText('periodWeek')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: 테스트 실행 → FAIL 확인**

```bash
npx vitest run src/components/admin/__tests__/CostChart.test.tsx
```

Expected: FAIL

- [ ] **Step 3: CostChart.tsx 생성**

```typescript
// src/components/admin/CostChart.tsx
'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { CostDataPoint } from '@/actions/admin'

const W = 400
const H = 120
const PAD = 16

interface Props {
  data: CostDataPoint[]
}

export function CostChart({ data }: Props) {
  const t = useTranslations('Admin')
  const router = useRouter()
  const searchParams = useSearchParams()
  const period = (searchParams.get('period') ?? 'week') as 'day' | 'week'

  const handlePeriod = (p: 'day' | 'week') => {
    const params = new URLSearchParams(searchParams)
    params.set('period', p)
    router.push(`?${params.toString()}`)
  }

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('estimatedCost')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">{t('noData')}</p>
        </CardContent>
      </Card>
    )
  }

  const costs = data.map(d => d.estimated_cost_usd)
  const minCost = Math.min(...costs)
  const maxCost = Math.max(...costs)
  const range = maxCost - minCost || 1

  const points = data.map((d, i) => {
    const x = PAD + (i / Math.max(data.length - 1, 1)) * (W - PAD * 2)
    const y = H - PAD - ((d.estimated_cost_usd - minCost) / range) * (H - PAD * 2)
    return { x, y, ...d }
  })

  const polyline = points.map(p => `${p.x},${p.y}`).join(' ')

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base">{t('estimatedCost')}</CardTitle>
        <div className="flex gap-1">
          {(['day', 'week'] as const).map(p => (
            <Button
              key={p}
              variant={period === p ? 'default' : 'ghost'}
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => handlePeriod(p)}
            >
              {p === 'day' ? t('periodDay') : t('periodWeek')}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
          <polyline
            points={polyline}
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth="2"
          />
          {points.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r="3" fill="hsl(var(--primary))" />
          ))}
        </svg>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 4: CostSummaryTable.tsx 생성**

```typescript
// src/components/admin/CostSummaryTable.tsx
'use client'

import { useTranslations } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { CostDataPoint } from '@/actions/admin'

interface Props {
  data: CostDataPoint[]
}

export function CostSummaryTable({ data }: Props) {
  const t = useTranslations('Admin')

  const totals = data.reduce(
    (acc, d) => ({
      calls: acc.calls + d.call_count,
      input: acc.input + d.input_tokens,
      output: acc.output + d.output_tokens,
      cost: acc.cost + d.estimated_cost_usd,
    }),
    { calls: 0, input: 0, output: 0, cost: 0 }
  )

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="text-base">Summary</CardTitle>
      </CardHeader>
      <CardContent>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2">Date</th>
              <th className="text-right py-2">{t('callCount')}</th>
              <th className="text-right py-2">{t('inputTokens')}</th>
              <th className="text-right py-2">{t('outputTokens')}</th>
              <th className="text-right py-2">{t('estimatedCost')}</th>
            </tr>
          </thead>
          <tbody>
            {data.map(row => (
              <tr key={row.date} className="border-b hover:bg-muted/50">
                <td className="py-2">{row.date}</td>
                <td className="py-2 text-right font-mono">{row.call_count}</td>
                <td className="py-2 text-right font-mono">{row.input_tokens.toLocaleString()}</td>
                <td className="py-2 text-right font-mono">{row.output_tokens.toLocaleString()}</td>
                <td className="py-2 text-right font-mono">${row.estimated_cost_usd.toFixed(4)}</td>
              </tr>
            ))}
            <tr className="font-semibold bg-muted/30">
              <td className="py-2">Total</td>
              <td className="py-2 text-right font-mono">{totals.calls}</td>
              <td className="py-2 text-right font-mono">{totals.input.toLocaleString()}</td>
              <td className="py-2 text-right font-mono">{totals.output.toLocaleString()}</td>
              <td className="py-2 text-right font-mono">${totals.cost.toFixed(4)}</td>
            </tr>
          </tbody>
        </table>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 5: CostChart 테스트 통과 확인**

```bash
npx vitest run src/components/admin/__tests__/CostChart.test.tsx
```

Expected: PASS

- [ ] **Step 6: admin/costs/page.tsx 생성**

```typescript
// src/app/[locale]/admin/costs/page.tsx
import { getTranslations } from 'next-intl/server'
import { getCostData } from '@/actions/admin'
import { CostChart } from '@/components/admin/CostChart'
import { CostSummaryTable } from '@/components/admin/CostSummaryTable'

interface Props {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ period?: string }>
}

export default async function AdminCostsPage({ params, searchParams }: Props) {
  const { locale } = await params
  const { period } = await searchParams
  const t = await getTranslations({ locale, namespace: 'Admin' })

  const validPeriod = period === 'day' ? 'day' : 'week'
  const data = await getCostData(validPeriod)

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">{t('costs')}</h1>
      <CostChart data={data} />
      <CostSummaryTable data={data} />
    </div>
  )
}
```

- [ ] **Step 7: 전체 테스트 통과 확인**

```bash
npx vitest run
```

Expected: 전체 PASS

- [ ] **Step 8: TypeScript 확인**

```bash
npx tsc --noEmit
```

Expected: 에러 없음

- [ ] **Step 9: Commit**

```bash
git add src/components/admin/CostChart.tsx src/components/admin/CostSummaryTable.tsx \
  src/app/[locale]/admin/costs/page.tsx \
  src/components/admin/__tests__/CostChart.test.tsx
git commit -m "feat: admin costs page with SVG chart and summary table"
```

---

## Task 12: 최종 검증

- [ ] **Step 1: 전체 테스트 실행**

```bash
npx vitest run
```

Expected: 기존 51개 + 신규 테스트 전부 PASS

- [ ] **Step 2: 빌드 확인**

```bash
npx next build
```

Expected: 에러 없음

- [ ] **Step 3: Final Commit**

```bash
git add -A
git status  # 커밋 안 된 파일 확인 후 선택적 add
git commit -m "feat: Admin MVP complete — credit adjust, cost monitoring, user suspend"
```
