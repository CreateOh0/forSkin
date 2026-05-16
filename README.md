# forSkin — AI Skin Analysis

Next.js App Router + Supabase + Claude AI + QStash 기반 피부 분석 서비스.

## 로컬 개발

```bash
npm install
npm run dev
```

## 환경 변수 설정

`.env.local` 파일 생성:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>   # 서버 전용, 클라이언트 노출 금지

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000       # 프로덕션: https://for-skin.vercel.app

# Anthropic
ANTHROPIC_API_KEY=sk-ant-...

# QStash (Upstash)
QSTASH_TOKEN=<token>
QSTASH_CURRENT_SIGNING_KEY=<signing-key>
QSTASH_NEXT_SIGNING_KEY=<next-signing-key>
QSTASH_URL=https://qstash-us-east-1.upstash.io  # us-east-1 엔드포인트 고정

# Cron
CRON_SECRET=<random-secret>   # Vercel cron 요청 인증용
```

## Supabase 설정

### DB 마이그레이션

```bash
# 순서대로 실행
supabase db push
# 또는 Supabase MCP / Dashboard SQL Editor에서
# supabase/migrations/ 파일을 001 → 003 순서로 실행
```

### Storage 버킷

Supabase Dashboard → Storage에서 `images` 버킷 생성 (Public: off).

### Google OAuth 설정

1. [Google Cloud Console](https://console.cloud.google.com) → OAuth 2.0 클라이언트 ID 생성
2. 승인된 리디렉션 URI 추가:
   ```
   https://<supabase-project>.supabase.co/auth/v1/callback
   ```
3. Supabase Dashboard → Authentication → Providers → Google
   - Client ID, Client Secret 입력
4. Supabase Dashboard → Authentication → URL Configuration → Redirect URLs에 추가:
   ```
   http://localhost:3000/auth/callback
   https://for-skin.vercel.app/auth/callback
   ```
   > next-intl 미들웨어가 `/auth/callback` → `/{locale}/auth/callback`으로 자동 리다이렉트하므로
   > 루트 경로(`/auth/callback`)를 등록하면 됩니다.

## QStash Worker

`/api/worker/analyze`는 QStash 서명 검증 후 Claude AI 분석을 실행합니다.
로컬 테스트 시 QStash → `ngrok` 또는 `localhost.run`으로 터널 필요.

## Vercel Cron

`vercel.json`의 cron job은 `Authorization: Bearer $CRON_SECRET` 헤더로 인증합니다.
Vercel Dashboard → Environment Variables에 `CRON_SECRET` 설정 필수.

## 테스트

```bash
npm run test:run   # 단위 테스트 (vitest)
```

## 배포

Vercel에 연결 후 위 환경 변수를 모두 설정하면 자동 배포됩니다.
`SUPABASE_SERVICE_ROLE_KEY`는 반드시 **Server-only** (Preview/Production)로만 설정하세요.
