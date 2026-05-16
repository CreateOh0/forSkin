# forSkin Admin MVP — Design Spec

**Date:** 2026-05-16  
**Status:** Approved  
**Scope:** Plan 4 — Admin MVP (크레딧 조정, Claude API 비용 모니터링, 유저 정지)

---

## 1. 목표

내부 Admin이 브라우저에서:
1. **유저 관리** — 유저 검색, 크레딧 수동 조정(추가/차감), 계정 정지/해제
2. **비용 모니터링** — Claude API 일별/주별 호출 수 · 추정 비용(USD) · 모델별 사용량 확인
3. **Overview** — 오늘의 분석 수, 비용, 신규 유저 요약

---

## 2. 아키텍처 개요

```
/[locale]/admin/          → Overview (stat cards)
/[locale]/admin/users/    → 유저 관리
/[locale]/admin/costs/    → 비용 모니터링
```

**보호 레이어 2단계:**
- `middleware.ts` — `/[locale]/admin/**` 경로에서 세션 없으면 `/[locale]/auth/login` 리다이렉트 (Edge, DB 조회 없음)
- `admin/layout.tsx` — `users` 테이블에서 `role` 읽어 `admin` 아니면 `/[locale]/dashboard` 리다이렉트

**데이터 흐름:** Server Components → Server Actions → Supabase Admin Client (서비스 롤 키, RLS 우회)

---

## 3. DB 스키마 변경

### 3.1 `analyses` 테이블 컬럼 추가

```sql
ALTER TABLE analyses
  ADD COLUMN input_tokens       INT,           -- claude-sonnet input tokens
  ADD COLUMN output_tokens      INT,           -- claude-sonnet output tokens
  ADD COLUMN estimated_cost_usd NUMERIC(10,6); -- 전체 비용 (sonnet + haiku 합산, USD)
```

기존 분석 행은 NULL 허용. 신규 분석부터 기록.

### 3.2 TypeScript 타입

`src/lib/supabase/types.ts`의 `analyses` Row/Insert/Update에 세 필드 추가:
```ts
input_tokens:       number | null
output_tokens:      number | null
estimated_cost_usd: number | null
```

---

## 4. AI 레이어 — 토큰 추적

### 4.1 `analyzeSkin` 반환 타입 변경

```ts
// 기존
Promise<SkinAnalysisResult>

// 변경 후
Promise<{
  result: SkinAnalysisResult
  usage: { input_tokens: number; output_tokens: number }
}>
```

`response.usage.input_tokens` / `response.usage.output_tokens` (Anthropic SDK 표준 필드).

### 4.2 `validateFace` 반환 타입 변경

```ts
Promise<{
  result: FaceValidationResult
  usage: { input_tokens: number; output_tokens: number }
}>
```

### 4.3 Worker 비용 계산 (`src/app/api/worker/analyze/route.ts`)

```ts
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

// analyses 업데이트 (status → completed 설정 시 함께)
await supabase.from('analyses').update({
  status: 'completed',
  input_tokens: analyzeUsage.input_tokens,
  output_tokens: analyzeUsage.output_tokens,
  estimated_cost_usd,
}).eq('id', analysis_id)
```

---

## 5. Admin 라우트 & 컴포넌트

### 5.1 파일 맵

**신규 생성:**
```
src/app/[locale]/admin/
  layout.tsx                         — AdminNav 사이드바 + role guard
  page.tsx                           — Overview 페이지
  users/page.tsx                     — 유저 관리 페이지
  costs/page.tsx                     — 비용 모니터링 페이지

src/components/admin/
  AdminNav.tsx                       — 좌측 네비 (Overview / Users / Costs)
  OverviewCards.tsx                  — 서버 컴포넌트, 오늘 분석·비용·신규 유저 3카드
  UserTable.tsx                      — 클라이언트, 검색·페이지네이션·액션 버튼
  CreditAdjustModal.tsx              — 클라이언트, delta(+/-) + note 입력 폼
  SuspendConfirmDialog.tsx           — shadcn AlertDialog 래퍼
  CostChart.tsx                      — SVG 라인 차트 (ScoreChart 패턴)
  CostSummaryTable.tsx               — sonnet/haiku 일별·주별 집계 테이블
  __tests__/
    UserTable.test.tsx
    CreditAdjustModal.test.tsx
    CostChart.test.tsx

src/actions/admin.ts                 — 모든 Admin Server Actions
src/actions/__tests__/admin.test.ts
```

**수정:**
```
middleware.ts                        — /admin 세션 guard 추가
src/lib/ai/analyze-skin.ts          — usage 반환
src/lib/ai/validate-face.ts         — usage 반환
src/app/api/worker/analyze/route.ts — 비용 계산 + analyses 업데이트
src/lib/supabase/types.ts           — analyses 3개 필드 추가
messages/ko.json
messages/en.json
messages/ja.json                    — Admin.* 키 추가
```

### 5.2 Server Actions (`src/actions/admin.ts`)

| 함수 | 설명 |
|------|------|
| `getAdminOverview()` | 오늘(UTC) 분석 수, 총 비용(USD), 신규 유저 수 |
| `getUsers(search?, page?)` | users + credits 조인, 10개씩 페이지네이션 |
| `adjustCredit(userId, delta, note)` | Supabase RPC `adjust_credit(user_id, delta, note)` — credit_transactions INSERT + credits.balance 갱신 원자적 실행 |
| `setSuspension(userId, banned)` | Supabase Auth Admin API `ban_duration` 설정/해제 |
| `getCostData(period: 'day' \| 'week')` | analyses 집계: 호출 수, input/output tokens, 추정 비용 |

모든 액션은 호출자의 `role=admin` 재검증 후 실행 (`createAdminClient()` 사용).

### 5.3 데이터 흐름 — Users 페이지

```
users/page.tsx (Server)
  └─ getUsers(searchParams) → UserTable (Client)
       ├─ 검색 입력 → router.push(?search=...) → 서버 재렌더
       ├─ 크레딧 버튼 → CreditAdjustModal
       │    └─ adjustCredit(userId, delta, note) Server Action → revalidatePath
       └─ 정지 버튼 → SuspendConfirmDialog
            └─ setSuspension(userId, true/false) Server Action → revalidatePath
```

### 5.4 데이터 흐름 — Costs 페이지

```
costs/page.tsx (Server)
  └─ getCostData(period) → CostChart (SVG) + CostSummaryTable (Client)
       └─ 기간 전환 버튼 → router.push(?period=week) → 서버 재렌더
```

---

## 6. 보안

- **미들웨어:** 세션 없으면 login 리다이렉트. DB 조회 없음(Edge 호환).
- **Layout role guard:** `users.role !== 'admin'` → dashboard 리다이렉트.
- **Server Actions:** 모든 Admin 액션 내부에서 `getUser()` + `role` 재검증. Admin Client는 서비스 롤 키 사용, RLS 우회.
- **ban_duration:** Supabase Auth Admin API `PUT /admin/users/{uid}` — 기존 세션 토큰 즉시 무효화.
- **크레딧 조정:** `credit_transactions`에 `admin_note` 포함 기록, 감사 추적 가능.

---

## 7. i18n

ko/en/ja 세 파일에 추가할 키:

```json
"Admin": {
  "overview": "Overview",
  "users": "사용자 관리",
  "costs": "비용 모니터링",
  "todayAnalyses": "오늘 분석",
  "todayCost": "오늘 비용",
  "newUsers": "신규 유저",
  "search": "이메일로 검색",
  "adjust": "크레딧 조정",
  "suspend": "정지",
  "unsuspend": "정지 해제",
  "creditDelta": "조정 크레딧 (음수 = 차감)",
  "note": "사유",
  "confirm": "확인",
  "period": { "day": "일별", "week": "주별" },
  "model": { "sonnet": "Sonnet", "haiku": "Haiku" },
  "estimatedCost": "추정 비용 (USD)",
  "callCount": "API 호출 수"
}
```

---

## 8. 테스트

| 파일 | 검증 항목 |
|------|-----------|
| `UserTable.test.tsx` | 검색 필터 렌더, 빈 목록 상태, 버튼 클릭 핸들러 |
| `CreditAdjustModal.test.tsx` | 양수/음수 delta 입력 유효성, 제출 시 Server Action 호출 |
| `CostChart.test.tsx` | SVG path 렌더, 빈 데이터 처리 |
| `admin.test.ts` | `adjustCredit` 트랜잭션 로직, `setSuspension` Admin API mock |

기존 테스트(51개) 회귀 없음 목표.

---

## 9. 구현 순서 (의존성)

1. DB 마이그레이션 (analyses 컬럼)
2. TypeScript 타입 업데이트
3. analyzeSkin / validateFace usage 반환
4. Worker 비용 계산 + analyses 저장
5. Admin Server Actions
6. middleware + admin layout (role guard)
7. OverviewCards, AdminNav
8. UserTable + CreditAdjustModal + SuspendConfirmDialog
9. CostChart + CostSummaryTable
10. i18n 키 추가
11. 테스트 작성
