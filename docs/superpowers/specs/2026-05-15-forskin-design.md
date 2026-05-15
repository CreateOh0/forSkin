# forSkin — 스킨케어 AI 분석 웹서비스 설계 문서

**작성일:** 2026-05-15  
**스택:** Next.js 14 App Router + Supabase + Claude Vision + Vercel  
**언어 지원:** 한국어, 영어, 일본어

---

## 1. 서비스 개요

카메라로 촬영한 얼굴 사진을 Claude Vision AI가 분석하여 피부 상태 진단과 스킨케어 루틴 추천을 제공하는 웹서비스. 크레딧 기반 과금, 선택적 회원가입, 분석 히스토리 추적 지원.

---

## 2. 아키텍처

### 페이지 구조

```
/[locale]/                    → 랜딩 (서비스 소개)
/[locale]/analyze             → 카메라 촬영 + 분석 요청
/[locale]/results/:id         → 분석 결과
/[locale]/dashboard           → 회원 히스토리 대시보드 (로그인 필요)
/[locale]/profile             → 회원 프로필 설정
/[locale]/auth/login          → 로그인
/[locale]/auth/signup         → 회원가입
```

### 데이터 흐름 (비동기)

```
사용자 촬영
  → /api/analyze (Next.js API Route)
    1. 인증 + 크레딧 검증
    2. Sharp로 이미지 압축 + 저해상도 썸네일 생성
    3. Supabase Storage 업로드 (원본 + 썸네일)
    4. analyses 레코드 생성 (status: validating)
    5. Upstash Queue에 작업 등록 → analysis_id 즉시 반환
  → 클라이언트: /[locale]/results/:id 이동 (로딩 상태)
  → Supabase Realtime 구독 시작 (analyses.status 변경 감지)

  [Queue Worker — 백그라운드]
    1. status → validating
       Claude Haiku Vision으로 얼굴 감지 + 이미지 품질 체크
       실패 시 → status: failed, 크레딧 환불, 클라이언트 알림
    2. status → processing
       Claude Sonnet Vision 본 분석 (언어별 시스템 프롬프트)
       JSON 파싱 + Zod 검증
    3. analysis_results 저장
    4. 크레딧 -1 차감 + 거래 기록
    5. 원본 이미지 삭제 예약 (24시간 후 Cron)
    6. status → completed → Realtime으로 클라이언트 Push

  → 클라이언트: 로딩 화면 → 결과 자동 표시
```

### 기술 스택

| 영역 | 선택 |
|------|------|
| 프레임워크 | Next.js 14 App Router |
| 스타일링 | Tailwind CSS + shadcn/ui |
| AI (본 분석) | Claude claude-sonnet-4-6 Vision (Anthropic SDK) |
| AI (사전 검증) | Claude claude-haiku-4-5 Vision — 얼굴 감지 + 품질 체크 |
| 인증 | NextAuth.js (이메일 + 구글 OAuth) |
| DB | Supabase (PostgreSQL) |
| 실시간 UX | Supabase Realtime — 분석 상태 클라이언트 Push |
| 비동기 큐 | Upstash Queue — 분석 작업 비동기 처리 |
| 이미지 처리 | Sharp — 압축 + 저해상도 썸네일 생성 |
| 스토리지 | Supabase Storage (Signed URL) |
| i18n | next-intl |
| 배포 | Vercel |

---

## 3. 다국어 (i18n)

- **지원 언어:** 한국어 (`ko`), 영어 (`en`), 일본어 (`ja`)
- **URL 구조:** `/[locale]/...` (예: `/ko/analyze`, `/en/dashboard`)
- **언어 선택:** 헤더 토글, 선택값 localStorage + 계정 설정에 저장
- **번역 파일:** `messages/ko.json`, `messages/en.json`, `messages/ja.json`
- **AI 출력:** Claude 프롬프트에 선택 언어 주입 → 진단/추천 텍스트 선택 언어로 생성

```typescript
// 언어 주입 예시
`Respond entirely in ${locale === 'ko' ? 'Korean' : locale === 'ja' ? 'Japanese' : 'English'}.
 All diagnosis and recommendations must be in the selected language.`
```

---

## 4. 데이터 모델

```sql
-- 사용자
users
  id uuid PK
  email text UNIQUE
  name text
  avatar_url text
  preferred_locale text DEFAULT 'ko'
  created_at timestamptz

-- 분석 세션
analyses
  id uuid PK
  user_id uuid NULLABLE FK → users
  session_token text  -- 비로그인 식별용
  image_url text
  locale text         -- 분석 시점 언어
  status text         -- pending | processing | completed | failed
  created_at timestamptz

-- 분석 세션 (이미지 라이프사이클 추가)
-- analyses 테이블에 아래 컬럼 추가:
--   thumbnail_url text        -- 저해상도 썸네일 (영구 보관)
--   original_expires_at timestamptz  -- 원본 삭제 예정 시각 (업로드 후 24시간)
--   original_deleted_at timestamptz  -- 실제 삭제 완료 시각

-- 분석 결과
analysis_results
  id uuid PK
  analysis_id uuid FK → analyses
  skin_type text              -- 건성|지성|복합성|민감성
  concerns jsonb              -- ["여드름", "모공", "건조함"]
  hydration_level int         -- 1~10
  overall_score int           -- 1~100
  diagnosis_text text         -- Claude 진단 텍스트
  recommendations jsonb       -- [{category, advice, key_ingredients}]
  comparison_data jsonb       -- 이전 분석 대비 수치 변화 (e.g. {"hydration_level": +2, "overall_score": +8})
  feature_points jsonb        -- 트러블 위치 좌표 [{x, y, type}] — 원본 삭제 후 시각화용
  raw_response jsonb

-- 추천 만족도
recommendation_ratings
  id uuid PK
  analysis_id uuid FK → analyses
  user_id uuid FK → users
  category text               -- 클렌징|토너|세럼|보습|선크림
  rating int                  -- 1~5
  comment text NULLABLE
  created_at timestamptz

-- 크레딧 잔액
credits
  id uuid PK
  user_id uuid UNIQUE FK → users
  balance int DEFAULT 0

-- 크레딧 거래 내역
credit_transactions
  id uuid PK
  user_id uuid FK → users
  amount int                  -- 양수(획득) / 음수(소모)
  type text                   -- signup|purchase|rating|streak|referral|analysis
  reference_id uuid NULLABLE  -- 관련 analysis_id 또는 purchase_id
  created_at timestamptz
```

**비로그인 접근:** 크레딧 시스템 도입으로 분석은 로그인 필수. 비로그인 사용자는 랜딩 → 결과 미리보기(블러 처리) → 회원가입 유도 플로우로 전환.

**비로그인 → 로그인 전환:** 회원가입 시 `session_token` 기반 과거 분석을 계정에 자동 연결 (세션 내 임시 분석 결과가 있을 경우).

---

## 5. Claude Vision 연동

### 2단계 AI 검증

**1단계 — 사전 검증 (Claude Haiku, 빠름/저비용)**
```json
{
  "face_detected": true,
  "quality_pass": true,
  "issues": []   // ["too_dark", "blurry", "no_face", "multiple_faces"]
}
```
- 얼굴 미감지 / 복수 얼굴 / 너무 어두움 / 블러 → 즉시 실패 반환
- 통과 시에만 2단계 진행 → 본 분석 비용 절감

**2단계 — 본 분석 (Claude Sonnet, 정밀)**

### 시스템 프롬프트 구조

```
당신은 피부과 전문의 수준의 스킨케어 분석 AI입니다.
사용자가 제공한 얼굴 사진을 분석하여 다음 JSON 형식으로만 응답하세요.
모든 텍스트는 [LANGUAGE]로 작성하세요.

{
  "skin_type": "건성|지성|복합성|민감성",
  "hydration_level": 1-10,
  "overall_score": 1-100,
  "concerns": ["관찰된 문제들"],
  "diagnosis": "전문적인 진단 텍스트 (200자 내외)",
  "recommendations": [
    {
      "category": "클렌징|토너|세럼|보습|선크림",
      "advice": "구체적인 사용법/추천 이유",
      "key_ingredients": ["성분1", "성분2"]
    }
  ]
}
```

### API Route `/api/analyze` (비동기 진입점)

1. 인증 + 크레딧 잔액 검증 (부족 시 402)
2. Sharp로 이미지 압축 + 썸네일 생성
3. Supabase Storage 업로드 (원본 + 썸네일, Signed URL)
4. `analyses` 레코드 생성 (status: `validating`, `original_expires_at` = now+24h)
5. Upstash Queue에 `{ analysis_id }` 등록
6. `analysis_id` 즉시 반환 → 클라이언트 results 페이지로 이동

### Queue Worker `/api/worker/analyze`

1. **1단계 — Haiku 사전 검증**
   - 실패 시: status → `failed`, 사유 저장, 크레딧 환불, Realtime Push
2. **2단계 — Sonnet 본 분석**
   - 이전 분석 있으면 `comparison_data` 계산 후 함께 저장
   - `feature_points` 추출 + 저장
3. 크레딧 -1 + 거래 기록
4. status → `completed`, Realtime Push
5. 원본 삭제 Cron 예약 (`original_expires_at` 기준)

### Cron `/api/cron/cleanup-images`

- 매시간 실행
- `original_expires_at < now AND original_deleted_at IS NULL` 조건 조회
- Supabase Storage 원본 삭제 → `original_deleted_at` 기록

### 에러 처리

| 상황 | 처리 |
|------|------|
| 얼굴 미감지 | status: failed, 재촬영 안내, 크레딧 환불 |
| 이미지 품질 불량 | status: failed, 밝기/각도 가이드, 크레딧 환불 |
| Sonnet API 오류 | 1회 재시도, 실패 시 크레딧 환불 + 에러 |
| 크레딧 부족 | 충전 모달 표시 |
| Worker 타임아웃 | status: failed, 크레딧 환불, 알림 |

---

## 6. 화면 설계

### `/[locale]/analyze` — 촬영

- **모바일:** `getUserMedia` API로 기기 카메라 직접 실행
- **데스크탑:** 웹캠 OR 파일 업로드 선택
- 촬영 가이드 오버레이 (얼굴 위치, 조명 안내)
- 촬영 후 미리보기 + 재촬영 / 분석 시작 버튼
- 헤더에 크레딧 잔액 표시, 분석 전 소모 안내

### `/[locale]/results/:id` — 실시간 분석 상태 + 결과

**분석 중 (status: validating / processing)**
```
Supabase Realtime 구독 → status 변경 시 UI 자동 업데이트

단계별 메시지:
  validating  → "얼굴을 인식하고 있습니다..."
  processing  → "피부 결 분석 중..." / "모공 상태 확인 중..." / "루틴 추천 생성 중..."
  failed      → 실패 사유 + 재시도 버튼
  completed   → 결과 자동 표시
```

**결과 표시 (status: completed)**
- 피부 점수 원형 게이지
- 피부 타입 + 문제 태그 뱃지
- 진단 텍스트 (선택 언어)
- 루틴 추천 카드 (카테고리별, 핵심 성분 태그)
- 비로그인 시: "결과 저장 및 변화 추적" 로그인 유도 배너

> **의료 면책 조항 (필수 노출):**
> "본 분석 결과는 전문적인 의료 진단을 대체할 수 없으며, 참고용으로만 사용하십시오."
> — 결과 페이지 하단 고정 표시, 3개 언어 각각 적용

### `/[locale]/dashboard` — 히스토리 대시보드

```
├── 요약 카드
│   ├── 총 분석 횟수
│   ├── 최근 피부 점수
│   └── 가장 많이 나온 문제
├── 피부 점수 변화 차트 (기간 필터: 1주/1달/3달/전체)
├── 분석 히스토리 리스트
│   ├── 날짜, 썸네일, 점수, 문제 태그
│   ├── 클릭 → /results/:id 상세
│   ├── 추천 만족도 평가 (별점 1~5, 카테고리별, 한줄 코멘트)
│   └── 삭제 기능
└── 효과 있었던 성분 집계 (만족도 4~5점 추천 기반)
```

### `/[locale]/auth/signup` — 회원가입

- 이메일 + 비밀번호
- 구글 소셜 로그인
- 이름, 선호 언어 설정 (선택)
- 비로그인 분석 히스토리 자동 연결 안내
- 가입 완료 시 5 크레딧 자동 지급

### `/[locale]/auth/login` — 로그인

- 이메일/비밀번호
- 구글 OAuth
- 비밀번호 찾기 링크

### `/[locale]/profile` — 프로필

- 이름, 이메일, 아바타 수정
- 기본 언어 설정 (EN/KO/JA)
- 알림 설정
- 계정 삭제

---

## 7. 크레딧 시스템

### 획득

| 방법 | 지급량 |
|------|--------|
| 신규 가입 | 5 크레딧 |
| 만족도 평가 작성 | 0.5 크레딧 |
| 7일 연속 사용 | 3 크레딧 |
| 친구 초대 (가입 완료) | 3 크레딧 |
| 유료 충전 | 구매량에 따라 |

### 유료 충전 플랜 (예시)

| 플랜 | 크레딧 | 가격 |
|------|--------|------|
| Basic | 10 | ₩2,900 |
| Standard | 30 | ₩6,900 |
| Premium | 100 | ₩19,900 |

### UX 규칙

- 헤더 크레딧 잔액 항상 표시
- 분석 시작 전 소모 안내 (1 크레딧)
- 잔액 0 → 충전 모달 자동 표시
- 비로그인 → 크레딧 없음 → 로그인 유도
- API 오류 시 크레딧 자동 환불

> **참고:** 결제 연동 (Stripe 또는 토스페이먼츠)은 MVP 이후 구현.

---

## 8. 에러 처리 + 보안

- 이미지 업로드 크기 제한: 10MB
- Supabase RLS(Row Level Security) — 본인 데이터만 접근
- API Route rate limiting — 동일 IP 분당 10회 제한
- Claude 응답 JSON 스키마 검증 (Zod)
- 이미지 접근: Signed URL (직접 URL 추측 불가)
- 이미지 저장 경로: `{user_id}/{analysis_id}/original.jpg`, `{user_id}/{analysis_id}/thumb.jpg`

### 이미지 라이프사이클 (Privacy by Design)

| 종류 | 보관 기간 | 삭제 방식 |
|------|-----------|-----------|
| 원본 고화질 | 분석 완료 후 24시간 | Cron Job 자동 삭제 |
| 저해상도 썸네일 | 사용자 계정 유지 기간 | 계정 삭제 시 함께 삭제 |
| feature_points (좌표) | 영구 보관 | 원본 삭제 후 시각화 대체 |

> 원본 이미지 삭제 후에도 `feature_points` 좌표로 트러블 위치 시각화 유지 (v2).

---

## 9. 관리자 대시보드

### 접근 제어

- URL: `/[locale]/admin/*`
- `users` 테이블에 `role: 'admin' | 'user'` 컬럼 추가
- 미들웨어에서 `admin` role 검증, 미인가 시 `/` 리다이렉트

### 페이지 구조

```
/admin/
├── /                  → 전체 현황 요약
├── /users             → 사용자 관리
├── /analyses          → 분석 현황
├── /credits           → 크레딧 관리
├── /revenue           → 매출 통계
├── /ai                → AI 사용량 + 프롬프트 성능
├── /moderation        → 불량 이미지 신고 처리
├── /pricing           → 요금제 + 할인 관리
└── /notices           → 공지 관리
```

### 화면별 상세

**`/admin`** — 전체 요약
```
├── 오늘 신규 가입자 수
├── 오늘 분석 횟수
├── 오늘 매출
├── 활성 사용자 수 (7일 기준)
├── Claude API 일일 비용
└── 미처리 신고 건수 (알림 뱃지)
```

**`/admin/users`** — 사용자 관리
```
├── 사용자 목록 (이메일, 가입일, 분석 횟수, 크레딧 잔액, 상태)
├── 검색 + 필터 (role, 상태, 가입일)
├── 사용자 상세
│   ├── 프로필 정보
│   ├── 분석 히스토리
│   ├── 크레딧 거래 내역
│   └── 계정 정지 / 복구 / 삭제
└── 크레딧 수동 지급/차감
```

**`/admin/analyses`** — 분석 현황
```
├── 분석 목록 (날짜, 사용자, 점수, 상태)
├── 상태별 필터 (completed / failed / processing)
├── 실패 분석 상세 (에러 원인, 크레딧 환불 여부)
└── 분석 이미지 + 결과 원본 조회
```

**`/admin/credits`** — 크레딧 관리
```
├── 전체 크레딧 발행량 / 소모량 / 잔액 합계
├── 거래 유형별 집계 (signup / purchase / rating / streak / referral)
├── 사용자별 수동 조정 (지급 / 차감 + 사유 메모)
└── 대량 지급 (이벤트용 — 조건 필터로 대상자 선택)
```

**`/admin/revenue`** — 매출 통계
```
├── 일/주/월별 매출 차트
├── 플랜별 판매 비율 (Basic / Standard / Premium)
├── 결제 수단별 집계
├── 환불 내역
└── MRR / ARR 추정 (정기 구매 패턴 기반)
```

**`/admin/ai`** — AI 사용량 + 프롬프트 성능
```
├── Claude API 일/월별 호출 수 + 비용
├── 평균 응답 시간
├── 오류율 (파싱 실패 / API 오류)
├── 프롬프트 버전 관리
│   ├── 버전별 평균 만족도 비교
│   ├── 버전별 피부 타입 분포
│   └── A/B 테스트 설정 (버전별 트래픽 비율)
└── 언어별 분석 요청 비율 (KO/EN/JA)
```

**`/admin/moderation`** — 신고 처리
```
├── 신고된 이미지 목록 (신고 사유, 신고자, 날짜)
├── 이미지 검토 + 조치 (삭제 / 무시 / 사용자 경고)
└── 자동 필터 설정 (얼굴 미감지 이미지 자동 차단 등)
```

**`/admin/notices`** — 공지 관리
```
├── 공지 목록 (제목, 언어, 노출 기간, 상태)
├── 공지 작성/수정/삭제
├── 언어별 개별 작성 (KO/EN/JA)
├── 노출 위치 설정 (배너 / 팝업 / 인앱 알림)
└── 예약 발송
```

**`/admin/pricing`** — 요금제 + 할인 관리
```
├── 요금제 관리
│   ├── 플랜 목록 (이름, 크레딧, 가격, 상태)
│   ├── 플랜 생성/수정/비활성화
│   ├── 언어별 플랜 이름/설명 설정 (KO/EN/JA)
│   └── 노출 순서 변경
├── 할인 코드 관리
│   ├── 할인 코드 목록 (코드, 할인율/금액, 유효기간, 사용 횟수)
│   ├── 코드 생성 (정률 % / 정액 ₩ 선택)
│   ├── 사용 조건 설정
│   │   ├── 최소 구매 크레딧 수
│   │   ├── 신규 가입자 전용 여부
│   │   ├── 1인당 사용 횟수 제한
│   │   └── 전체 사용 횟수 제한
│   ├── 유효기간 설정 (시작일/종료일)
│   └── 코드 비활성화/삭제
├── 이벤트 할인 관리
│   ├── 기간 한정 플랜 가격 할인 (% 또는 ₩)
│   ├── 보너스 크레딧 설정 (플랜 구매 시 N 크레딧 추가 지급)
│   └── 이벤트 활성화/종료
└── 할인 통계
    ├── 코드별 사용 횟수 + 할인 총액
    └── 이벤트별 매출 증감 비교
```

### DB 추가

```sql
-- 관리자 role
ALTER TABLE users ADD COLUMN role text DEFAULT 'user';  -- 'user' | 'admin'

-- 관리자 크레딧 수동 조정 메모
ALTER TABLE credit_transactions ADD COLUMN admin_note text NULLABLE;

-- 프롬프트 버전 관리
prompt_versions
  id uuid PK
  version text           -- 'v1.0', 'v1.1'
  content text           -- 시스템 프롬프트 전문
  is_active bool
  traffic_ratio int      -- A/B 테스트용 비율 (0~100)
  created_at timestamptz

-- 분석에 프롬프트 버전 연결
ALTER TABLE analyses ADD COLUMN prompt_version_id uuid FK → prompt_versions;

-- 공지
notices
  id uuid PK
  locale text            -- 'ko' | 'en' | 'ja' | 'all'
  title text
  content text
  position text          -- 'banner' | 'popup' | 'inapp'
  starts_at timestamptz
  ends_at timestamptz
  is_active bool
  created_by uuid FK → users
  created_at timestamptz

-- 신고
reports
  id uuid PK
  analysis_id uuid FK → analyses
  reporter_id uuid FK → users
  reason text
  status text            -- 'pending' | 'dismissed' | 'actioned'
  reviewed_by uuid NULLABLE FK → users
  reviewed_at timestamptz NULLABLE
  created_at timestamptz

-- 요금제 플랜
plans
  id uuid PK
  name_ko text
  name_en text
  name_ja text
  credits int
  price int              -- 원화 기준 (₩)
  is_active bool
  sort_order int
  created_at timestamptz

-- 할인 코드
discount_codes
  id uuid PK
  code text UNIQUE
  type text              -- 'percent' | 'fixed'
  value int              -- % 또는 ₩
  min_credits int        -- 최소 구매 크레딧 (0 = 제한 없음)
  new_user_only bool DEFAULT false
  per_user_limit int     -- 1인당 사용 횟수 (0 = 무제한)
  total_limit int        -- 전체 사용 횟수 (0 = 무제한)
  used_count int DEFAULT 0
  starts_at timestamptz NULLABLE
  ends_at timestamptz NULLABLE
  is_active bool DEFAULT true
  created_by uuid FK → users
  created_at timestamptz

-- 할인 코드 사용 내역
discount_code_usages
  id uuid PK
  code_id uuid FK → discount_codes
  user_id uuid FK → users
  purchase_id uuid       -- 연결된 결제 ID
  discount_amount int    -- 실제 할인 금액 (₩)
  created_at timestamptz

-- 이벤트 할인
promotions
  id uuid PK
  name text
  plan_id uuid NULLABLE FK → plans   -- null = 전체 플랜
  discount_type text     -- 'percent' | 'fixed'
  discount_value int
  bonus_credits int DEFAULT 0        -- 구매 시 추가 지급 크레딧
  starts_at timestamptz
  ends_at timestamptz
  is_active bool DEFAULT false
  created_by uuid FK → users
  created_at timestamptz
```

---

## 10. MVP 범위 (1차 출시)

**포함:**
- 카메라 촬영 + 2단계 Claude Vision 분석 (Haiku 사전검증 + Sonnet 본분석)
- 비동기 처리 (Upstash Queue + Supabase Realtime 상태 UX)
- 결과 페이지 (진단 + 루틴 추천 + 의료 면책 조항)
- 이미지 라이프사이클 (원본 24시간 후 자동 삭제, 썸네일 보관)
- 선택적 계정 (이메일 + 구글)
- 크레딧 시스템 (무료 지급 + 활동 보상, 결제 제외)
- 대시보드 히스토리
- 만족도 평가
- 3개국어 (KO/EN/JA)
- 관리자 경량 버전 (`/admin`) — 3기능
  - 크레딧 수동 조정 (CS 대응)
  - Claude API 비용 모니터링 (비용 폭증 감지)
  - 사용자 정지/삭제 (어뷰징 대응)

**v2 이후:**
- Ghost Mode — 이전 사진 오버레이로 동일 각도 촬영 지원
- Skin Journey — 분석간 수치 변화 시각화 (수분도 +15% 등)
- feature_points — 트러블 위치 좌표 기반 시각화
- 유료 결제 (Stripe / 토스페이먼츠)
- 쇼핑 API 연동 (올리브영, 쿠팡)
- 푸시 알림
- 친구 초대 시스템
- 관리자 전체 기능
  - 매출 통계 + 요금제/할인 관리
  - 프롬프트 A/B 테스트
  - 신고 처리
  - 공지 관리
  - 분석 현황 상세
