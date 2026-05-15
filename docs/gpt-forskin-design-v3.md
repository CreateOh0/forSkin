# gpt-forskin-design-v3.md

# forSkin — AI 피부 분석 SaaS 플랫폼 통합 설계 문서 (v3.0)

**Version:** v3.0  
**Date:** 2026-05-15  
**Project Type:** AI Skin Analysis SaaS  
**Key Update:** 비동기 UX 강화, 데이터 보안 정책 고도화 및 분석 품질 추적 로직 추가

---

# 1. 프로젝트 개요
forSkin은 사용자가 업로드한 얼굴 사진을 AI Vision 모델이 분석하여 피부 상태 분석과 스킨케어 루틴을 제공하는 AI 기반 피부 분석 플랫폼입니다.

**서비스 목적:**
* 피부 상태 시각화 및 정밀 분석
* 피부 변화의 장기적 추적 (Skin Journey)
* 개인화된 맞춤 루틴 제공
* 재방문 유도 및 스킨케어 습관 형성

---

# 2. 핵심 제품 전략
## 핵심 검증 포인트
"사용자가 피부 분석 결과를 신뢰하고 변화를 확인하기 위해 반복 사용하는가?"

**집중 분야:**
1. **분석 정확도:** 정교한 프롬프트 엔지니어링 및 모델 최적화
2. **비동기 UX:** Vision API의 지연 시간을 사용자 경험으로 승화
3. **재방문율 (Retention):** 과거 데이터와의 비교를 통한 가치 체감

---

# 3. 서비스 포지셔닝 및 주의사항
* **서비스 정의:** AI 기반 피부 상태 분석 및 스킨케어 가이드 플랫폼
* **의료 면책 조항 (Mandatory):** * 본 서비스는 의료 서비스나 질환 진단 목적이 아닙니다.
    * 결과 페이지 하단에 **"본 분석 결과는 전문적인 의료 진단을 대체할 수 없으며, 참고용으로만 사용하십시오."** 문구를 반드시 명시합니다.

---

# 4. 핵심 기능 (MVP)

### 사용자 기능
* **인증:** 회원가입, 로그인 (NextAuth.js)
* **분석 요청 (Analyze):**
    * 얼굴 사진 업로드 및 촬영 가이드
    * **Ghost Mode:** 이전 분석 사진을 오버레이하여 동일한 각도에서 촬영 지원
* **실시간 상태 확인:** 분석 진행 상황(얼굴 검출 -> 분석 중 -> 결과 생성)을 실시간으로 확인
* **결과 확인 (Results):**
    * 정밀 진단 텍스트 및 루틴 추천
    * **Skin Journey:** 이전 결과와의 수치 비교 (예: 수분도 +15% 개선)
* **히스토리 (Dashboard):** 과거 분석 내역 관리 및 변화 추적 차트

### 관리자 기능
* **사용자 및 로그 관리:** 사용자 현황 및 분석 실패 사례 모니터링
* **Prompt Playground:** 시스템 프롬프트 버전 관리 및 실시간 튜닝
* **비용 모니터링:** AI API 사용량 및 비용 관리

---

# 5. 기술 스택

| 영역 | 기술 | 비고 |
| :--- | :--- | :--- |
| **Frontend** | Next.js 14 App Router | SSR/ISR 활용 |
| **UI/Component** | Tailwind CSS / shadcn/ui | 빠른 UI 구축 |
| **Realtime UX** | **Supabase Realtime** | 분석 상태 실시간 업데이트 |
| **AI API** | OpenAI Responses API | gpt-5.1 (Main), gpt-5.1-mini (Valid) |
| **Database** | Supabase PostgreSQL | 관계형 데이터 저장 |
| **Storage** | Supabase Storage | 이미지 관리 (Signed URL) |
| **Queue/Worker** | Upstash Queue / Railway | 비동기 작업 처리 |
| **Image Processing** | Sharp | 이미지 압축 및 썸네일 생성 |
| **Validation** | Zod | 데이터 유효성 검증 |

---

# 6. 시스템 아키텍처 (비동기 흐름)

1. **Upload:** 사용자 사진 업로드 및 Sharp를 통한 이미지 압축
2. **Pre-Validation:** `gpt-5.1-mini`가 얼굴 검출 및 조명/품질 검사 (실패 시 즉시 반환)
3. **Queueing:** 분석 작업을 Queue에 등록
4. **Realtime Status:** Worker가 작업을 시작하면 Supabase Realtime을 통해 클라이언트에 상태 메시지 전송
    * *메시지 예시: "피부 결 분석 중...", "모공 상태 확인 중..."*
5. **Main Analysis:** `gpt-5.1` Vision 모델을 통해 정밀 분석 수행
6. **Data Post-Processing:**
    * 과거 결과와 비교 데이터 계산
    * 특징점(JSON) 추출 및 저장
    * 고화질 원본은 24시간 후 삭제 스케줄링
7. **Complete:** 결과 저장 후 클라이언트에 완료 알림 및 리다이렉트

---

# 7. 데이터 모델 (고도화)

### 핵심 테이블 구조
* **analysis_results:**
    * `skin_score`, `concerns` (JSONB), `diagnosis_text`
    * **`comparison_data` (JSONB):** 이전 분석 대비 개선 수치
    * **`feature_points` (JSONB):** 트러블 위치 좌표 (이미지 삭제 후 시각화용)
* **ingredients (Master):**
    * 추천 성분 마스터 테이블 (필터링 및 매칭 최적화)
* **prompt_versions:**
    * AI 응답 품질 관리를 위한 프롬프트 버전 및 성능 추적 데이터

---

# 8. 개인정보 및 보안 정책 (Privacy by Design)

* **이미지 라이프사이클:**
    * **원본 이미지 (High-res):** 분석 완료 24시간 후 자동 영구 삭제
    * **히스토리용 이미지 (Low-res/Blurred):** 사용자 대시보드용으로 저해상도 또는 특정 부위 마스킹 처리된 이미지 보관
* **보안:** Supabase RLS를 통한 데이터 접근 제어, Signed URL 사용

---

# 9. MVP 범위 및 출시 전략

### Phase 1 (MVP)
* **포함:** 로그인, 사진 업로드(Ghost Mode), 비동기 정밀 분석, 실시간 상태 UX, 비교 대시보드, 면책 조항 노출
* **언어:** 한국어 우선

### Phase 2 (확장)
* **포함:** 유료 크레딧 시스템, 다국어 지원, 성분 기반 상세 제품 매칭

---

# 10. 핵심 KPI
* **재방문율 (Retention):** 주간/월간 재분석 사용자 비율
* **분석 성공률:** 전처리 단계에서의 탈락률 최소화
* **사용자 만족도:** 결과의 신뢰도 및 변화 확인 경험

---

# 11. 결론
v3.0 설계는 **비동기 처리의 UX 완성도**를 높이고, **데이터 보안과 사용자 히스토리 사이의 균형**을 맞추는 데 집중했습니다. 특히 이전 분석 결과와의 시각적/수치적 비교 기능을 강화함으로써 사용자가 지속적으로 서비스를 이용할 강력한 동기를 제공합니다.
