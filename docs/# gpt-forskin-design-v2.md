# gpt-forskin-design-v2.md

# forSkin — AI 피부 분석 SaaS 플랫폼 통합 설계 문서

Version: v2.0
Date: 2026-05-15
Project Type: AI Skin Analysis SaaS

---

# 1. 프로젝트 개요

forSkin은 사용자가 업로드한 얼굴 사진을 AI Vision 모델이 분석하여 피부 상태 분석과 스킨케어 루틴을 제공하는 AI 기반 피부 분석 플랫폼입니다.

서비스 목적은:

* 피부 상태 시각화
* 피부 변화 추적
* 맞춤 루틴 제공
* 반복 사용 유도
* 장기적인 스킨케어 습관 형성

입니다.

---

# 2. 핵심 제품 전략

## 핵심 검증 포인트

초기 MVP의 핵심 목표는 아래 하나입니다.

```text
사용자가 피부 분석 결과를 신뢰하고 반복 사용하는가?
```

초기 단계에서는:

* 수익화
* 쇼핑 연동
* 광고
* 추천 시스템

보다

```text
분석 정확도 + 사용자 경험 + 재방문율
```

검증에 집중합니다.

---

# 3. 서비스 포지셔닝

## 서비스 정의

```text
AI 기반 피부 상태 분석 및 스킨케어 가이드 플랫폼
```

---

## 주의사항

본 서비스는:

* 의료 서비스가 아닙니다
* 피부 질환 진단 서비스가 아닙니다
* 참고용 AI 분석 서비스입니다

---

# 4. 핵심 기능

## MVP 기능

### 사용자

* 회원가입
* 로그인
* 얼굴 사진 업로드
* 피부 분석
* 결과 확인
* 분석 히스토리

### 관리자

* 사용자 관리
* 분석 로그 확인
* AI 비용 모니터링
* 실패 분석 재처리

---

# 5. 기술 스택

| 영역                | 기술                     |
| ----------------- | ---------------------- |
| Frontend          | Next.js 14 App Router  |
| UI                | Tailwind CSS           |
| Component         | shadcn/ui              |
| Backend           | Next.js Route Handlers |
| AI API            | OpenAI Responses API   |
| Main Vision Model | gpt-5.1                |
| Validation Model  | gpt-5.1-mini           |
| Database          | Supabase PostgreSQL    |
| Storage           | Supabase Storage       |
| Auth              | NextAuth.js            |
| Queue             | Upstash Queue          |
| Worker            | Railway                |
| Image Processing  | Sharp                  |
| Validation        | Zod                    |
| Deploy            | Vercel                 |

---

# 6. 시스템 아키텍처

```text
사용자 사진 업로드
    ↓
이미지 압축 (Sharp)
    ↓
gpt-5.1-mini
- 얼굴 검출
- 품질 검사
- 조명 검사
    ↓
Queue 등록
    ↓
Worker 실행
    ↓
gpt-5.1 Vision 분석
    ↓
JSON Schema Validation
    ↓
DB 저장
    ↓
결과 반환
```

---

# 7. 프로젝트 폴더 구조

```text
/app
 ├── [locale]
 │    ├── page.tsx
 │    ├── analyze
 │    ├── results
 │    ├── dashboard
 │    ├── auth
 │    └── profile

/components
 ├── ui
 ├── charts
 ├── analysis
 └── routine

/lib
 ├── auth
 ├── supabase
 ├── openai
 ├── queue
 └── validation

/services
 ├── image
 ├── ai
 └── storage

/workers
 └── analyze-worker

/messages
 ├── ko.json
 ├── en.json
 └── ja.json
```

---

# 8. AI 모델 전략

## 메인 모델

```text
gpt-5.1
```

사용 목적:

* 피부 상태 분석
* 루틴 생성
* 설명 생성
* JSON 구조화

---

## 검증 모델

```text
gpt-5.1-mini
```

사용 목적:

* 얼굴 검출
* 이미지 품질 검사
* 비용 절감

---

# 9. OpenAI API 구조

## 사용 API

```text
Responses API
```

---

## 호출 예시

```typescript
const response = await client.responses.create({
  model: "gpt-5.1",
  input: [
    {
      role: "system",
      content: systemPrompt
    },
    {
      role: "user",
      content: [
        {
          type: "input_text",
          text: "피부 상태를 분석해주세요."
        },
        {
          type: "input_image",
          image_url: imageUrl
        }
      ]
    }
  ]
});
```

---

# 10. 개인정보 정책

## 얼굴 이미지는 민감 정보로 간주

필수 정책:

* 개인정보 처리방침
* AI 분석 동의
* 얼굴 이미지 처리 동의
* 삭제 정책

---

## 저장 정책

```text
원본 얼굴 이미지는 24시간 후 자동 삭제
```

---

# 11. 보안 전략

* Supabase RLS
* Rate Limiting
* MIME Type Validation
* Zod Validation
* Signed URL
* 업로드 제한 10MB

---

# 12. Queue 시스템

```text
Upload
 → Queue
 → Worker
 → OpenAI API
 → Save Result
```

추천:

* Upstash Queue
* Trigger.dev
* BullMQ

---

# 13. MVP 범위

## 포함

* 로그인
* 사진 업로드
* 피부 분석
* 결과 페이지
* 히스토리

## 제외

* 결제
* 쇼핑 연동
* 추천 평가
* 광고
* 다국어

---

# 14. 출시 전략

## Phase 1

```text
무료
한국어
피부 분석
히스토리
```

## Phase 2

```text
유료 크레딧
```

## Phase 3

```text
다국어
추천 시스템
쇼핑 연동
```

---

# 15. 핵심 KPI

* 재방문율
* 분석 반복 횟수
* 사용자 만족도
* 평균 분석 시간

---

# 16. 최종 권장 아키텍처

```text
Frontend:
Next.js 14

Backend:
Route Handlers + Queue Worker

AI:
OpenAI Responses API
- gpt-5.1
- gpt-5.1-mini

Database:
Supabase PostgreSQL

Storage:
Supabase Storage

Image:
Sharp

Queue:
Upstash Queue

Deploy:
Vercel + Railway
```

---

# 17. 결론

forSkin은:

* AI Vision
* 반복 분석
* 피부 변화 추적

기반의 AI 스킨케어 SaaS 플랫폼입니다.

초기 단계에서는:

* 분석 품질
* UX
* 재방문율

검증에 집중하고,

이후:

* 유료화
* 추천 시스템
* 쇼핑 연동

으로 확장하는 전략이 가장 현실적입니다.
