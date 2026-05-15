# forSkin — Plan 1: Foundation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold the complete Next.js 14 foundation — project setup, Supabase schema, Supabase Auth (email + Google OAuth), next-intl i18n (KO/EN/JA), and base layout with Header, auth pages, and profile page.

**Architecture:** Next.js 14 App Router with `[locale]` dynamic segment for automatic language routing. Supabase handles DB + Auth (GoTrue). All user-facing pages live under `/[locale]/`. Single combined middleware handles both i18n routing and Supabase session refresh.

**Tech Stack:** Next.js 14, TypeScript, Tailwind CSS, shadcn/ui, Supabase (PostgreSQL + Auth + Storage), @supabase/ssr, next-intl, Vitest, React Testing Library, Zod

> **Note on Auth:** Using Supabase Auth (GoTrue) instead of NextAuth.js. Supabase Auth integrates natively with Row Level Security (RLS) via `auth.uid()`, eliminating adapter complexity. Identical features: email/password, Google OAuth, session management.

---

## File Map

```
forSkin/
├── middleware.ts                          # i18n routing + Supabase session refresh
├── next.config.ts                         # Next.js config with next-intl plugin
├── vitest.config.ts                       # Vitest config
├── .env.local.example                     # Required env vars template
├── messages/
│   ├── ko.json                            # Korean UI strings
│   ├── en.json                            # English UI strings
│   └── ja.json                            # Japanese UI strings
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql         # All DB tables + RLS + triggers + seed
├── src/
│   ├── app/
│   │   ├── [locale]/
│   │   │   ├── layout.tsx                 # Locale root layout (NextIntlClientProvider)
│   │   │   ├── page.tsx                   # Landing page
│   │   │   ├── auth/
│   │   │   │   ├── callback/route.ts      # OAuth callback handler
│   │   │   │   ├── login/page.tsx
│   │   │   │   └── signup/page.tsx
│   │   │   └── profile/page.tsx
│   │   └── globals.css
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Header.tsx                 # Nav + locale switcher + credit display
│   │   │   ├── LocaleSwitcher.tsx         # KO/EN/JA dropdown
│   │   │   └── Footer.tsx                 # Medical disclaimer + copyright
│   │   └── auth/
│   │       ├── LoginForm.tsx
│   │       └── SignupForm.tsx
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts                  # Browser Supabase client
│   │   │   ├── server.ts                  # Server Supabase client (cookies)
│   │   │   ├── middleware.ts              # Session refresh helper
│   │   │   └── types.ts                   # Database types
│   │   ├── i18n/
│   │   │   └── request.ts                 # next-intl server config + locale exports
│   │   └── env.ts                         # Zod env validation
│   ├── actions/
│   │   ├── auth.ts                        # Server actions: login, signup, logout, google
│   │   └── profile.ts                     # Server actions: updateProfile
│   └── test/
│       └── setup.ts                       # Vitest global setup (@testing-library/jest-dom)
```

---

## Task 1: Project Scaffolding

**Files:** `package.json`, `next.config.ts`, `tsconfig.json`, `tailwind.config.ts`

- [ ] **Step 1: Scaffold Next.js app**

```bash
cd /Users/cj/Dev/forSkin
npx create-next-app@latest . \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --import-alias "@/*" \
  --yes
```

Expected: `src/app/` directory exists. `package.json` present.

- [ ] **Step 2: Install runtime dependencies**

```bash
npm install \
  @supabase/supabase-js \
  @supabase/ssr \
  next-intl \
  sharp \
  zod
```

Expected: No peer dependency errors.

- [ ] **Step 3: Install dev dependencies**

```bash
npm install -D \
  vitest \
  @vitejs/plugin-react \
  @testing-library/react \
  @testing-library/user-event \
  @testing-library/jest-dom \
  jsdom
```

- [ ] **Step 4: Initialize shadcn/ui**

```bash
npx shadcn@latest init --defaults
```

When prompted: Style → Default, Base color → Slate, CSS variables → yes.

```bash
npx shadcn@latest add button card input label form \
  dropdown-menu avatar badge separator select toast
```

Expected: `src/components/ui/` directory with component files.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: scaffold Next.js 14 project with Tailwind and shadcn/ui"
```

---

## Task 2: Environment + Test Infrastructure

**Files:** `.env.local.example`, `src/lib/env.ts`, `vitest.config.ts`, `src/test/setup.ts`

- [ ] **Step 1: Create env template**

Create `.env.local.example`:

```
# Supabase — get from https://supabase.com/dashboard/project/_/settings/api
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Copy to `.env.local` and fill in values from your Supabase project dashboard.

- [ ] **Step 2: Create Zod env validation**

Create `src/lib/env.ts`:

```typescript
import { z } from 'zod'

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),
})

export const env = envSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
})
```

- [ ] **Step 3: Create Vitest config**

Create `vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

- [ ] **Step 4: Create test setup**

Create `src/test/setup.ts`:

```typescript
import '@testing-library/jest-dom'
```

- [ ] **Step 5: Add test scripts to package.json**

In `package.json`, add to the `scripts` section:

```json
"test": "vitest",
"test:run": "vitest run"
```

- [ ] **Step 6: Verify test infrastructure**

Create `src/test/smoke.test.ts`:

```typescript
test('test infrastructure works', () => {
  expect(1 + 1).toBe(2)
})
```

Run: `npm run test:run`
Expected output: `1 passed`

Delete `src/test/smoke.test.ts`.

- [ ] **Step 7: Commit**

```bash
git add .env.local.example src/lib/env.ts vitest.config.ts src/test/setup.ts package.json
git commit -m "feat: add env validation and Vitest test infrastructure"
```

---

## Task 3: Supabase Schema

**Files:** `supabase/migrations/001_initial_schema.sql`

- [ ] **Step 1: Create migrations directory**

```bash
mkdir -p supabase/migrations
```

- [ ] **Step 2: Write schema migration**

Create `supabase/migrations/001_initial_schema.sql`:

```sql
-- ============================================================
-- TABLES
-- ============================================================

-- Users (extends auth.users)
CREATE TABLE public.users (
  id uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email text NOT NULL,
  name text,
  avatar_url text,
  preferred_locale text DEFAULT 'ko' CHECK (preferred_locale IN ('ko', 'en', 'ja')),
  role text DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at timestamptz DEFAULT now()
);

-- Analyses
CREATE TABLE public.analyses (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  session_token text,
  image_url text,
  thumbnail_url text,
  locale text DEFAULT 'ko' CHECK (locale IN ('ko', 'en', 'ja')),
  status text DEFAULT 'pending'
    CHECK (status IN ('pending', 'validating', 'processing', 'completed', 'failed')),
  original_expires_at timestamptz,
  original_deleted_at timestamptz,
  prompt_version_id uuid,
  created_at timestamptz DEFAULT now()
);

-- Analysis results
CREATE TABLE public.analysis_results (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  analysis_id uuid REFERENCES public.analyses(id) ON DELETE CASCADE UNIQUE,
  skin_type text,
  concerns jsonb DEFAULT '[]'::jsonb,
  hydration_level integer CHECK (hydration_level BETWEEN 1 AND 10),
  overall_score integer CHECK (overall_score BETWEEN 1 AND 100),
  diagnosis_text text,
  recommendations jsonb DEFAULT '[]'::jsonb,
  comparison_data jsonb,
  feature_points jsonb DEFAULT '[]'::jsonb,
  raw_response jsonb,
  created_at timestamptz DEFAULT now()
);

-- Recommendation ratings
CREATE TABLE public.recommendation_ratings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  analysis_id uuid REFERENCES public.analyses(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  category text NOT NULL,
  rating integer CHECK (rating BETWEEN 1 AND 5),
  comment text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(analysis_id, user_id, category)
);

-- Credits balance
CREATE TABLE public.credits (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  balance integer DEFAULT 0 CHECK (balance >= 0)
);

-- Credit transactions
CREATE TABLE public.credit_transactions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  amount integer NOT NULL,
  type text CHECK (type IN ('signup','purchase','rating','streak','referral','analysis','refund')),
  reference_id uuid,
  admin_note text,
  created_at timestamptz DEFAULT now()
);

-- Prompt versions (for AI A/B testing)
CREATE TABLE public.prompt_versions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  version text NOT NULL UNIQUE,
  content text NOT NULL,
  is_active boolean DEFAULT false,
  traffic_ratio integer DEFAULT 0 CHECK (traffic_ratio BETWEEN 0 AND 100),
  created_at timestamptz DEFAULT now()
);

-- Notices
CREATE TABLE public.notices (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  locale text DEFAULT 'all',
  title text NOT NULL,
  content text NOT NULL,
  position text CHECK (position IN ('banner', 'popup', 'inapp')),
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean DEFAULT false,
  created_by uuid REFERENCES public.users(id),
  created_at timestamptz DEFAULT now()
);

-- Reports (content moderation)
CREATE TABLE public.reports (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  analysis_id uuid REFERENCES public.analyses(id) ON DELETE CASCADE,
  reporter_id uuid REFERENCES public.users(id),
  reason text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'dismissed', 'actioned')),
  reviewed_by uuid REFERENCES public.users(id),
  reviewed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Pricing plans
CREATE TABLE public.plans (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name_ko text NOT NULL,
  name_en text NOT NULL,
  name_ja text NOT NULL,
  credits integer NOT NULL CHECK (credits > 0),
  price integer NOT NULL CHECK (price >= 0),
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Discount codes
CREATE TABLE public.discount_codes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  code text UNIQUE NOT NULL,
  type text CHECK (type IN ('percent', 'fixed')),
  value integer NOT NULL CHECK (value > 0),
  min_credits integer DEFAULT 0,
  new_user_only boolean DEFAULT false,
  per_user_limit integer DEFAULT 0,
  total_limit integer DEFAULT 0,
  used_count integer DEFAULT 0,
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean DEFAULT true,
  created_by uuid REFERENCES public.users(id),
  created_at timestamptz DEFAULT now()
);

-- Discount code usages
CREATE TABLE public.discount_code_usages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  code_id uuid REFERENCES public.discount_codes(id),
  user_id uuid REFERENCES public.users(id),
  purchase_id uuid,
  discount_amount integer NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Promotions (time-limited price events)
CREATE TABLE public.promotions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  plan_id uuid REFERENCES public.plans(id),
  discount_type text CHECK (discount_type IN ('percent', 'fixed')),
  discount_value integer NOT NULL CHECK (discount_value > 0),
  bonus_credits integer DEFAULT 0,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  is_active boolean DEFAULT false,
  created_by uuid REFERENCES public.users(id),
  created_at timestamptz DEFAULT now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analysis_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recommendation_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prompt_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discount_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discount_code_usages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;

-- Users: own row + admin reads all
CREATE POLICY "users_own_rw" ON public.users
  FOR ALL USING (auth.uid() = id);

CREATE POLICY "users_admin_read" ON public.users
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
  );

-- Analyses: own rows
CREATE POLICY "analyses_own_rw" ON public.analyses
  FOR ALL USING (auth.uid() = user_id);

-- Analysis results: through own analyses
CREATE POLICY "results_own_read" ON public.analysis_results
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.analyses a
      WHERE a.id = analysis_results.analysis_id AND a.user_id = auth.uid()
    )
  );

-- Recommendation ratings: own rows
CREATE POLICY "ratings_own_rw" ON public.recommendation_ratings
  FOR ALL USING (auth.uid() = user_id);

-- Credits: own row
CREATE POLICY "credits_own_rw" ON public.credits
  FOR ALL USING (auth.uid() = user_id);

-- Credit transactions: own rows (read only)
CREATE POLICY "transactions_own_read" ON public.credit_transactions
  FOR SELECT USING (auth.uid() = user_id);

-- Plans: public read (active only)
CREATE POLICY "plans_public_read" ON public.plans
  FOR SELECT USING (is_active = true);

-- Notices: public read when active and in schedule
CREATE POLICY "notices_public_read" ON public.notices
  FOR SELECT USING (
    is_active = true
    AND (starts_at IS NULL OR starts_at <= now())
    AND (ends_at IS NULL OR ends_at >= now())
  );

-- Promotions: public read when active
CREATE POLICY "promotions_public_read" ON public.promotions
  FOR SELECT USING (
    is_active = true AND starts_at <= now() AND ends_at >= now()
  );

-- ============================================================
-- TRIGGER: auto-create profile + 5 signup credits
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.users (id, email, name, avatar_url)
  VALUES (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'name',
    new.raw_user_meta_data ->> 'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.credits (user_id, balance)
  VALUES (new.id, 5)
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.credit_transactions (user_id, amount, type)
  VALUES (new.id, 5, 'signup');

  RETURN new;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- SEED DATA
-- ============================================================

INSERT INTO public.plans (name_ko, name_en, name_ja, credits, price, sort_order) VALUES
  ('베이직', 'Basic', 'ベーシック', 10, 2900, 1),
  ('스탠다드', 'Standard', 'スタンダード', 30, 6900, 2),
  ('프리미엄', 'Premium', 'プレミアム', 100, 19900, 3);

INSERT INTO public.prompt_versions (version, content, is_active, traffic_ratio) VALUES
  ('v1.0', 'You are a skincare analysis AI with dermatologist-level expertise.', true, 100);
```

- [ ] **Step 3: Apply migration in Supabase Dashboard**

Go to: Supabase Dashboard → SQL Editor → New query → paste the SQL above → Run.

Expected: "Success. No rows returned" — all tables created.

- [ ] **Step 4: Verify tables in Table Editor**

In Supabase Dashboard → Table Editor, confirm present:
`users`, `analyses`, `analysis_results`, `recommendation_ratings`, `credits`, `credit_transactions`, `prompt_versions`, `notices`, `reports`, `plans`, `discount_codes`, `discount_code_usages`, `promotions`

- [ ] **Step 5: Commit**

```bash
git add supabase/
git commit -m "feat: add complete Supabase schema with RLS policies and signup trigger"
```

---

## Task 4: Supabase Client Helpers

**Files:** `src/lib/supabase/types.ts`, `src/lib/supabase/client.ts`, `src/lib/supabase/server.ts`, `src/lib/supabase/middleware.ts`
**Test:** `src/lib/supabase/client.test.ts`

- [ ] **Step 1: Write failing test**

Create `src/lib/supabase/client.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'

vi.mock('@supabase/ssr', () => ({
  createBrowserClient: vi.fn(() => ({ auth: { getSession: vi.fn() } })),
  createServerClient: vi.fn(() => ({ auth: { getUser: vi.fn() } })),
}))

describe('Supabase browser client', () => {
  it('createClient returns a client with auth', async () => {
    const { createClient } = await import('./client')
    const client = createClient()
    expect(client).toBeDefined()
    expect(client.auth).toBeDefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test:run -- src/lib/supabase/client.test.ts
```

Expected: FAIL — `Cannot find module './client'`

- [ ] **Step 3: Create DB types**

Create `src/lib/supabase/types.ts`:

```typescript
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Locale = 'ko' | 'en' | 'ja'
export type UserRole = 'user' | 'admin'
export type AnalysisStatus = 'pending' | 'validating' | 'processing' | 'completed' | 'failed'
export type CreditTransactionType = 'signup' | 'purchase' | 'rating' | 'streak' | 'referral' | 'analysis' | 'refund'

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          name: string | null
          avatar_url: string | null
          preferred_locale: Locale
          role: UserRole
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['users']['Row'], 'created_at'> & { created_at?: string }
        Update: Partial<Database['public']['Tables']['users']['Insert']>
      }
      analyses: {
        Row: {
          id: string
          user_id: string | null
          session_token: string | null
          image_url: string | null
          thumbnail_url: string | null
          locale: Locale
          status: AnalysisStatus
          original_expires_at: string | null
          original_deleted_at: string | null
          prompt_version_id: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['analyses']['Row'], 'id' | 'created_at'> & { id?: string; created_at?: string }
        Update: Partial<Database['public']['Tables']['analyses']['Insert']>
      }
      analysis_results: {
        Row: {
          id: string
          analysis_id: string
          skin_type: string | null
          concerns: Json
          hydration_level: number | null
          overall_score: number | null
          diagnosis_text: string | null
          recommendations: Json
          comparison_data: Json | null
          feature_points: Json
          raw_response: Json | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['analysis_results']['Row'], 'id' | 'created_at'> & { id?: string; created_at?: string }
        Update: Partial<Database['public']['Tables']['analysis_results']['Insert']>
      }
      credits: {
        Row: { id: string; user_id: string; balance: number }
        Insert: Omit<Database['public']['Tables']['credits']['Row'], 'id'> & { id?: string }
        Update: Partial<Database['public']['Tables']['credits']['Insert']>
      }
      credit_transactions: {
        Row: {
          id: string
          user_id: string
          amount: number
          type: CreditTransactionType
          reference_id: string | null
          admin_note: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['credit_transactions']['Row'], 'id' | 'created_at'> & { id?: string; created_at?: string }
        Update: Partial<Database['public']['Tables']['credit_transactions']['Insert']>
      }
      plans: {
        Row: {
          id: string
          name_ko: string
          name_en: string
          name_ja: string
          credits: number
          price: number
          is_active: boolean
          sort_order: number
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['plans']['Row'], 'id' | 'created_at'> & { id?: string; created_at?: string }
        Update: Partial<Database['public']['Tables']['plans']['Insert']>
      }
    }
  }
}
```

- [ ] **Step 4: Create browser client**

Create `src/lib/supabase/client.ts`:

```typescript
import { createBrowserClient } from '@supabase/ssr'
import type { Database } from './types'

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

- [ ] **Step 5: Create server client**

Create `src/lib/supabase/server.ts`:

```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from './types'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )
}

export async function createServiceClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )
}
```

- [ ] **Step 6: Create middleware session helper**

Create `src/lib/supabase/middleware.ts`:

```typescript
import { createServerClient } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server'
import type { Database } from './types'

export async function updateSession(request: NextRequest, response: NextResponse) {
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value)
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  // Refreshes session — required for server-side auth to work
  await supabase.auth.getUser()

  return response
}
```

- [ ] **Step 7: Run test to verify it passes**

```bash
npm run test:run -- src/lib/supabase/client.test.ts
```

Expected: `1 passed`

- [ ] **Step 8: Commit**

```bash
git add src/lib/supabase/
git commit -m "feat: add Supabase client helpers (browser, server, middleware, types)"
```

---

## Task 5: i18n Setup

**Files:** `src/lib/i18n/request.ts`, `messages/ko.json`, `messages/en.json`, `messages/ja.json`, `next.config.ts`, `middleware.ts`
**Test:** `src/lib/i18n/request.test.ts`

- [ ] **Step 1: Write failing test**

Create `src/lib/i18n/request.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { locales, defaultLocale } from './request'

describe('i18n config', () => {
  it('exports supported locales', () => {
    expect(locales).toEqual(['ko', 'en', 'ja'])
  })

  it('default locale is ko', () => {
    expect(defaultLocale).toBe('ko')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test:run -- src/lib/i18n/request.test.ts
```

Expected: FAIL — `Cannot find module './request'`

- [ ] **Step 3: Create i18n request config**

Create `src/lib/i18n/request.ts`:

```typescript
import { getRequestConfig } from 'next-intl/server'
import { notFound } from 'next/navigation'

export const locales = ['ko', 'en', 'ja'] as const
export type AppLocale = (typeof locales)[number]
export const defaultLocale: AppLocale = 'ko'

export default getRequestConfig(async ({ requestLocale }) => {
  const locale = await requestLocale

  if (!locale || !locales.includes(locale as AppLocale)) {
    notFound()
  }

  return {
    locale,
    messages: (await import(`../../../messages/${locale}.json`)).default,
  }
})
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm run test:run -- src/lib/i18n/request.test.ts
```

Expected: `2 passed`

- [ ] **Step 5: Create Korean messages**

Create `messages/ko.json`:

```json
{
  "nav": {
    "analyze": "피부 분석",
    "dashboard": "대시보드",
    "profile": "프로필",
    "login": "로그인",
    "signup": "회원가입",
    "logout": "로그아웃",
    "credits": "{count}크레딧"
  },
  "landing": {
    "title": "AI 피부 분석",
    "subtitle": "사진 한 장으로 전문적인 피부 진단을 받으세요",
    "cta": "무료로 시작하기",
    "features": {
      "analysis": "정밀 피부 분석",
      "routine": "맞춤 루틴 추천",
      "history": "피부 변화 추적"
    }
  },
  "auth": {
    "email": "이메일",
    "password": "비밀번호",
    "name": "이름",
    "login": "로그인",
    "signup": "회원가입",
    "logout": "로그아웃",
    "loginTitle": "로그인",
    "signupTitle": "회원가입",
    "loginSubtitle": "계정에 로그인하세요",
    "signupSubtitle": "새 계정을 만드세요. 가입 시 5크레딧 지급!",
    "noAccount": "계정이 없으신가요?",
    "hasAccount": "이미 계정이 있으신가요?",
    "forgotPassword": "비밀번호를 잊으셨나요?",
    "continueWithGoogle": "Google로 계속하기",
    "or": "또는",
    "errors": {
      "invalidCredentials": "이메일 또는 비밀번호가 올바르지 않습니다",
      "emailInUse": "이미 사용 중인 이메일입니다",
      "unexpected": "오류가 발생했습니다. 다시 시도해주세요"
    }
  },
  "profile": {
    "title": "프로필",
    "save": "저장",
    "saved": "저장되었습니다",
    "deleteAccount": "계정 삭제",
    "deleteConfirm": "정말 계정을 삭제하시겠습니까? 모든 데이터가 삭제됩니다.",
    "language": "언어",
    "notifications": "알림 설정"
  },
  "disclaimer": "본 분석 결과는 전문적인 의료 진단을 대체할 수 없으며, 참고용으로만 사용하십시오."
}
```

- [ ] **Step 6: Create English messages**

Create `messages/en.json`:

```json
{
  "nav": {
    "analyze": "Skin Analysis",
    "dashboard": "Dashboard",
    "profile": "Profile",
    "login": "Login",
    "signup": "Sign Up",
    "logout": "Logout",
    "credits": "{count} credits"
  },
  "landing": {
    "title": "AI Skin Analysis",
    "subtitle": "Get professional skin diagnosis from a single photo",
    "cta": "Start for free",
    "features": {
      "analysis": "Precise Skin Analysis",
      "routine": "Personalized Routine",
      "history": "Track Skin Changes"
    }
  },
  "auth": {
    "email": "Email",
    "password": "Password",
    "name": "Name",
    "login": "Login",
    "signup": "Sign Up",
    "logout": "Logout",
    "loginTitle": "Login",
    "signupTitle": "Sign Up",
    "loginSubtitle": "Login to your account",
    "signupSubtitle": "Create a new account. Get 5 free credits!",
    "noAccount": "Don't have an account?",
    "hasAccount": "Already have an account?",
    "forgotPassword": "Forgot password?",
    "continueWithGoogle": "Continue with Google",
    "or": "or",
    "errors": {
      "invalidCredentials": "Invalid email or password",
      "emailInUse": "Email already in use",
      "unexpected": "An error occurred. Please try again"
    }
  },
  "profile": {
    "title": "Profile",
    "save": "Save",
    "saved": "Saved",
    "deleteAccount": "Delete Account",
    "deleteConfirm": "Are you sure you want to delete your account? All data will be permanently deleted.",
    "language": "Language",
    "notifications": "Notification Settings"
  },
  "disclaimer": "This analysis is not a substitute for professional medical diagnosis and should be used for reference only."
}
```

- [ ] **Step 7: Create Japanese messages**

Create `messages/ja.json`:

```json
{
  "nav": {
    "analyze": "肌分析",
    "dashboard": "ダッシュボード",
    "profile": "プロフィール",
    "login": "ログイン",
    "signup": "登録",
    "logout": "ログアウト",
    "credits": "{count}クレジット"
  },
  "landing": {
    "title": "AI肌分析",
    "subtitle": "1枚の写真でプロの肌診断を受けよう",
    "cta": "無料で始める",
    "features": {
      "analysis": "精密肌分析",
      "routine": "カスタムルーティン",
      "history": "肌変化の追跡"
    }
  },
  "auth": {
    "email": "メールアドレス",
    "password": "パスワード",
    "name": "名前",
    "login": "ログイン",
    "signup": "登録",
    "logout": "ログアウト",
    "loginTitle": "ログイン",
    "signupTitle": "アカウント作成",
    "loginSubtitle": "アカウントにログイン",
    "signupSubtitle": "新しいアカウントを作成。5クレジットプレゼント！",
    "noAccount": "アカウントをお持ちでないですか？",
    "hasAccount": "すでにアカウントをお持ちですか？",
    "forgotPassword": "パスワードをお忘れですか？",
    "continueWithGoogle": "Googleで続ける",
    "or": "または",
    "errors": {
      "invalidCredentials": "メールアドレスまたはパスワードが正しくありません",
      "emailInUse": "このメールアドレスはすでに使用されています",
      "unexpected": "エラーが発生しました。もう一度お試しください"
    }
  },
  "profile": {
    "title": "プロフィール",
    "save": "保存",
    "saved": "保存しました",
    "deleteAccount": "アカウント削除",
    "deleteConfirm": "本当にアカウントを削除しますか？すべてのデータが削除されます。",
    "language": "言語",
    "notifications": "通知設定"
  },
  "disclaimer": "この分析結果は専門的な医療診断の代替にはなりません。参考目的のみにご使用ください。"
}
```

- [ ] **Step 8: Update Next.js config**

Replace `next.config.ts`:

```typescript
import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./src/lib/i18n/request.ts')

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/**',
      },
    ],
  },
}

export default withNextIntl(nextConfig)
```

- [ ] **Step 9: Create combined middleware**

Replace (or create) `middleware.ts` at project root:

```typescript
import createIntlMiddleware from 'next-intl/middleware'
import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'
import { locales, defaultLocale } from '@/lib/i18n/request'

const intlMiddleware = createIntlMiddleware({
  locales,
  defaultLocale,
})

export async function middleware(request: NextRequest) {
  const intlResponse = intlMiddleware(request)
  const response = intlResponse instanceof NextResponse
    ? intlResponse
    : NextResponse.next({ request })

  return updateSession(request, response)
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
}
```

- [ ] **Step 10: Commit**

```bash
git add src/lib/i18n/ messages/ middleware.ts next.config.ts
git commit -m "feat: add next-intl i18n with KO/EN/JA and combined middleware"
```

---

## Task 6: Auth Server Actions + OAuth Callback

**Files:** `src/actions/auth.ts`, `src/app/[locale]/auth/callback/route.ts`
**Test:** `src/actions/auth.test.ts`

- [ ] **Step 1: Write failing test**

Create `src/actions/auth.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSignInWithPassword = vi.fn()
const mockSignUp = vi.fn()
const mockSignOut = vi.fn()
const mockSignInWithOAuth = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: {
      signInWithPassword: mockSignInWithPassword,
      signUp: mockSignUp,
      signOut: mockSignOut,
      signInWithOAuth: mockSignInWithOAuth,
    },
  })),
}))

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}))

vi.mock('next/headers', () => ({
  headers: vi.fn(async () => ({ get: vi.fn(() => 'http://localhost:3000') })),
}))

describe('auth actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSignInWithPassword.mockResolvedValue({ error: null })
    mockSignUp.mockResolvedValue({ error: null })
    mockSignOut.mockResolvedValue({ error: null })
  })

  it('login calls signInWithPassword with email and password', async () => {
    const { login } = await import('./auth')
    const formData = new FormData()
    formData.set('email', 'test@example.com')
    formData.set('password', 'password123')

    await login(formData)

    expect(mockSignInWithPassword).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'password123',
    })
  })

  it('signup calls signUp with email, password, name', async () => {
    const { signup } = await import('./auth')
    const formData = new FormData()
    formData.set('email', 'new@example.com')
    formData.set('password', 'password123')
    formData.set('name', 'Test User')

    await signup(formData)

    expect(mockSignUp).toHaveBeenCalledWith({
      email: 'new@example.com',
      password: 'password123',
      options: { data: { name: 'Test User' } },
    })
  })

  it('login returns error object when credentials invalid', async () => {
    mockSignInWithPassword.mockResolvedValueOnce({ error: { message: 'Invalid credentials' } })
    const { login } = await import('./auth')
    const formData = new FormData()
    formData.set('email', 'bad@example.com')
    formData.set('password', 'wrong')

    const result = await login(formData)

    expect(result).toEqual({ error: 'Invalid credentials' })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test:run -- src/actions/auth.test.ts
```

Expected: FAIL — `Cannot find module './auth'`

- [ ] **Step 3: Create auth server actions**

Create `src/actions/auth.ts`:

```typescript
'use server'

import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'

export async function login(formData: FormData) {
  const supabase = await createClient()
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) return { error: error.message }

  redirect('/ko/dashboard')
}

export async function signup(formData: FormData) {
  const supabase = await createClient()
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const name = formData.get('name') as string

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name } },
  })

  if (error) return { error: error.message }

  redirect('/ko/dashboard')
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/ko')
}

export async function loginWithGoogle(locale: string = 'ko') {
  const supabase = await createClient()
  const headersList = await headers()
  const origin = headersList.get('origin') ?? 'http://localhost:3000'

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${origin}/auth/callback?next=/${locale}/dashboard`,
    },
  })

  if (error || !data.url) return { error: error?.message ?? 'OAuth failed' }

  redirect(data.url)
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm run test:run -- src/actions/auth.test.ts
```

Expected: `3 passed`

- [ ] **Step 5: Create OAuth callback route**

```bash
mkdir -p src/app/\[locale\]/auth/callback
```

Create `src/app/[locale]/auth/callback/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/ko/dashboard'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/ko/auth/login?error=oauth_failed`)
}
```

- [ ] **Step 6: Configure Google OAuth in Supabase**

In Supabase Dashboard → Authentication → Providers → Google:
1. Toggle Google **ON**
2. Paste Google Client ID and Secret (from Google Cloud Console → OAuth 2.0 credentials)
3. Add to Authorized redirect URIs in Google Console: `https://your-project.supabase.co/auth/v1/callback`
4. Add to Supabase allowed redirect URLs: `http://localhost:3000/auth/callback`

- [ ] **Step 7: Commit**

```bash
git add src/actions/auth.ts src/app/
git commit -m "feat: add Supabase Auth server actions and Google OAuth callback"
```

---

## Task 7: Header + LocaleSwitcher + Footer

**Files:** `src/components/layout/Header.tsx`, `src/components/layout/LocaleSwitcher.tsx`, `src/components/layout/Footer.tsx`
**Test:** `src/components/layout/Header.test.tsx`

- [ ] **Step 1: Write failing test**

Create `src/components/layout/Header.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Header } from './Header'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'ko',
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/ko',
}))

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
  }),
}))

vi.mock('@/actions/auth', () => ({
  logout: vi.fn(),
}))

describe('Header', () => {
  it('renders analyze navigation link', () => {
    render(<Header />)
    expect(screen.getByText('nav.analyze')).toBeInTheDocument()
  })

  it('shows login and signup when not authenticated', () => {
    render(<Header />)
    expect(screen.getByText('nav.login')).toBeInTheDocument()
    expect(screen.getByText('nav.signup')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test:run -- src/components/layout/Header.test.tsx
```

Expected: FAIL — `Cannot find module './Header'`

- [ ] **Step 3: Create LocaleSwitcher**

Create `src/components/layout/LocaleSwitcher.tsx`:

```tsx
'use client'

import { useLocale } from 'next-intl'
import { useRouter, usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const localeLabels = { ko: '한국어', en: 'English', ja: '日本語' } as const

export function LocaleSwitcher() {
  const locale = useLocale()
  const router = useRouter()
  const pathname = usePathname()

  function switchLocale(newLocale: string) {
    const segments = pathname.split('/')
    segments[1] = newLocale
    router.push(segments.join('/'))
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm">
          {localeLabels[locale as keyof typeof localeLabels] ?? locale}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {Object.entries(localeLabels).map(([code, label]) => (
          <DropdownMenuItem
            key={code}
            onClick={() => switchLocale(code)}
            className={locale === code ? 'font-semibold' : ''}
          >
            {label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
```

- [ ] **Step 4: Create Header**

Create `src/components/layout/Header.tsx`:

```tsx
'use client'

import Link from 'next/link'
import { useTranslations, useLocale } from 'next-intl'
import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { logout } from '@/actions/auth'
import { LocaleSwitcher } from './LocaleSwitcher'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export function Header() {
  const t = useTranslations('nav')
  const locale = useLocale()
  const [user, setUser] = useState<User | null>(null)
  const [credits, setCredits] = useState<number | null>(null)

  useEffect(() => {
    const supabase = createClient()

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) loadCredits(session.user.id, supabase)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null)
      if (session?.user) loadCredits(session.user.id, supabase)
      else setCredits(null)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function loadCredits(userId: string, supabase: ReturnType<typeof createClient>) {
    const { data } = await supabase
      .from('credits')
      .select('balance')
      .eq('user_id', userId)
      .single()
    setCredits(data?.balance ?? 0)
  }

  return (
    <header className="border-b bg-white sticky top-0 z-50">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href={`/${locale}`} className="font-bold text-lg tracking-tight">
          forSkin
        </Link>

        <nav className="flex items-center gap-1">
          <Link href={`/${locale}/analyze`}>
            <Button variant="ghost" size="sm">{t('analyze')}</Button>
          </Link>

          {user ? (
            <>
              <Link href={`/${locale}/dashboard`}>
                <Button variant="ghost" size="sm">{t('dashboard')}</Button>
              </Link>
              {credits !== null && (
                <Badge variant="secondary" className="mx-1">
                  {t('credits', { count: credits })}
                </Badge>
              )}
              <Link href={`/${locale}/profile`}>
                <Button variant="ghost" size="sm">{t('profile')}</Button>
              </Link>
              <form action={logout}>
                <Button variant="ghost" size="sm" type="submit">{t('logout')}</Button>
              </form>
            </>
          ) : (
            <>
              <Link href={`/${locale}/auth/login`}>
                <Button variant="ghost" size="sm">{t('login')}</Button>
              </Link>
              <Link href={`/${locale}/auth/signup`}>
                <Button size="sm">{t('signup')}</Button>
              </Link>
            </>
          )}

          <LocaleSwitcher />
        </nav>
      </div>
    </header>
  )
}
```

- [ ] **Step 5: Create Footer**

Create `src/components/layout/Footer.tsx`:

```tsx
import { useTranslations } from 'next-intl'

export function Footer() {
  const t = useTranslations()

  return (
    <footer className="border-t mt-auto py-6">
      <div className="max-w-5xl mx-auto px-4 text-center text-sm text-muted-foreground space-y-1">
        <p className="font-medium">{t('disclaimer')}</p>
        <p>© {new Date().getFullYear()} forSkin</p>
      </div>
    </footer>
  )
}
```

- [ ] **Step 6: Run test to verify it passes**

```bash
npm run test:run -- src/components/layout/Header.test.tsx
```

Expected: `2 passed`

- [ ] **Step 7: Commit**

```bash
git add src/components/layout/
git commit -m "feat: add Header with auth state, credit badge, LocaleSwitcher, and Footer"
```

---

## Task 8: Locale Root Layout

**Files:** `src/app/[locale]/layout.tsx`

- [ ] **Step 1: Replace locale layout**

Replace `src/app/[locale]/layout.tsx`:

```tsx
import type { Metadata } from 'next'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { locales } from '@/lib/i18n/request'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import '../globals.css'

export const metadata: Metadata = {
  title: 'forSkin — AI 피부 분석',
  description: 'AI 기반 피부 분석 및 스킨케어 루틴 추천',
}

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }))
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params

  if (!locales.includes(locale as (typeof locales)[number])) {
    notFound()
  }

  const messages = await getMessages()

  return (
    <html lang={locale}>
      <body className="min-h-screen flex flex-col">
        <NextIntlClientProvider messages={messages}>
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/[locale]/layout.tsx
git commit -m "feat: add locale root layout with NextIntlClientProvider"
```

---

## Task 9: Landing Page

**Files:** `src/app/[locale]/page.tsx`
**Test:** `src/app/[locale]/page.test.tsx`

- [ ] **Step 1: Write failing test**

Create `src/app/[locale]/page.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import LandingPage from './page'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'ko',
}))

describe('LandingPage', () => {
  it('renders CTA button', () => {
    render(<LandingPage />)
    expect(screen.getByText('landing.cta')).toBeInTheDocument()
  })

  it('renders all three feature cards', () => {
    render(<LandingPage />)
    expect(screen.getByText('landing.features.analysis')).toBeInTheDocument()
    expect(screen.getByText('landing.features.routine')).toBeInTheDocument()
    expect(screen.getByText('landing.features.history')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test:run -- "src/app/\[locale\]/page.test.tsx"
```

Expected: FAIL — page not yet implemented.

- [ ] **Step 3: Implement landing page**

Replace `src/app/[locale]/page.tsx`:

```tsx
'use client'

import Link from 'next/link'
import { useTranslations, useLocale } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export default function LandingPage() {
  const t = useTranslations('landing')
  const locale = useLocale()

  return (
    <div className="max-w-5xl mx-auto px-4 py-20 flex flex-col items-center text-center gap-16">
      <section className="flex flex-col items-center gap-6 max-w-xl">
        <h1 className="text-5xl font-bold tracking-tight">{t('title')}</h1>
        <p className="text-xl text-muted-foreground">{t('subtitle')}</p>
        <Link href={`/${locale}/auth/signup`}>
          <Button size="lg" className="text-base px-8 h-12">{t('cta')}</Button>
        </Link>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full">
        {(['analysis', 'routine', 'history'] as const).map((key) => (
          <Card key={key} className="p-2">
            <CardContent className="pt-6 pb-4 text-center">
              <p className="font-semibold">{t(`features.${key}`)}</p>
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm run test:run -- "src/app/\[locale\]/page.test.tsx"
```

Expected: `2 passed`

- [ ] **Step 5: Commit**

```bash
git add "src/app/[locale]/page.tsx" "src/app/[locale]/page.test.tsx"
git commit -m "feat: add landing page with hero and feature cards"
```

---

## Task 10: Login Page

**Files:** `src/components/auth/LoginForm.tsx`, `src/app/[locale]/auth/login/page.tsx`
**Test:** `src/components/auth/LoginForm.test.tsx`

- [ ] **Step 1: Write failing test**

Create `src/components/auth/LoginForm.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LoginForm } from './LoginForm'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'ko',
}))

vi.mock('@/actions/auth', () => ({
  login: vi.fn().mockResolvedValue(undefined),
  loginWithGoogle: vi.fn().mockResolvedValue(undefined),
}))

describe('LoginForm', () => {
  it('renders email and password inputs', () => {
    render(<LoginForm />)
    expect(screen.getByLabelText('auth.email')).toBeInTheDocument()
    expect(screen.getByLabelText('auth.password')).toBeInTheDocument()
  })

  it('renders Google login button', () => {
    render(<LoginForm />)
    expect(screen.getByText('auth.continueWithGoogle')).toBeInTheDocument()
  })

  it('shows error message when login returns error', async () => {
    const { login } = await import('@/actions/auth')
    vi.mocked(login).mockResolvedValueOnce({ error: 'Invalid credentials' })

    render(<LoginForm />)
    await userEvent.type(screen.getByLabelText('auth.email'), 'bad@test.com')
    await userEvent.type(screen.getByLabelText('auth.password'), 'wrong')
    await userEvent.click(screen.getByRole('button', { name: 'auth.login' }))

    expect(await screen.findByText('Invalid credentials')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test:run -- src/components/auth/LoginForm.test.tsx
```

Expected: FAIL — `Cannot find module './LoginForm'`

- [ ] **Step 3: Create LoginForm**

Create `src/components/auth/LoginForm.tsx`:

```tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useTranslations, useLocale } from 'next-intl'
import { login, loginWithGoogle } from '@/actions/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

export function LoginForm() {
  const t = useTranslations('auth')
  const locale = useLocale()
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function handleSubmit(formData: FormData) {
    setPending(true)
    setError(null)
    const result = await login(formData)
    if (result?.error) setError(result.error)
    setPending(false)
  }

  async function handleGoogle() {
    setPending(true)
    await loginWithGoogle(locale)
    setPending(false)
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>{t('loginTitle')}</CardTitle>
        <CardDescription>{t('loginSubtitle')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={handleGoogle}
          disabled={pending}
        >
          {t('continueWithGoogle')}
        </Button>

        <div className="flex items-center gap-2">
          <Separator className="flex-1" />
          <span className="text-xs text-muted-foreground">{t('or')}</span>
          <Separator className="flex-1" />
        </div>

        <form action={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">{t('email')}</Label>
            <Input id="email" name="email" type="email" required autoComplete="email" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">{t('password')}</Label>
            <Input id="password" name="password" type="password" required autoComplete="current-password" />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={pending}>
            {t('login')}
          </Button>
        </form>

        <p className="text-sm text-center text-muted-foreground">
          {t('noAccount')}{' '}
          <Link href={`/${locale}/auth/signup`} className="underline underline-offset-2">
            {t('signup')}
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 4: Create login page**

```bash
mkdir -p "src/app/[locale]/auth/login"
```

Create `src/app/[locale]/auth/login/page.tsx`:

```tsx
import { LoginForm } from '@/components/auth/LoginForm'

export default function LoginPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-16 flex justify-center">
      <LoginForm />
    </div>
  )
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npm run test:run -- src/components/auth/LoginForm.test.tsx
```

Expected: `3 passed`

- [ ] **Step 6: Commit**

```bash
git add src/components/auth/LoginForm.tsx src/components/auth/LoginForm.test.tsx "src/app/[locale]/auth/login/"
git commit -m "feat: add login page with email/password form and Google OAuth"
```

---

## Task 11: Signup Page

**Files:** `src/components/auth/SignupForm.tsx`, `src/app/[locale]/auth/signup/page.tsx`
**Test:** `src/components/auth/SignupForm.test.tsx`

- [ ] **Step 1: Write failing test**

Create `src/components/auth/SignupForm.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SignupForm } from './SignupForm'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'ko',
}))

vi.mock('@/actions/auth', () => ({
  signup: vi.fn().mockResolvedValue(undefined),
  loginWithGoogle: vi.fn().mockResolvedValue(undefined),
}))

describe('SignupForm', () => {
  it('renders name, email, and password inputs', () => {
    render(<SignupForm />)
    expect(screen.getByLabelText('auth.name')).toBeInTheDocument()
    expect(screen.getByLabelText('auth.email')).toBeInTheDocument()
    expect(screen.getByLabelText('auth.password')).toBeInTheDocument()
  })

  it('shows error when signup returns error', async () => {
    const { signup } = await import('@/actions/auth')
    vi.mocked(signup).mockResolvedValueOnce({ error: 'Email already in use' })

    render(<SignupForm />)
    await userEvent.type(screen.getByLabelText('auth.name'), 'Test User')
    await userEvent.type(screen.getByLabelText('auth.email'), 'taken@test.com')
    await userEvent.type(screen.getByLabelText('auth.password'), 'password123')
    await userEvent.click(screen.getByRole('button', { name: 'auth.signup' }))

    expect(await screen.findByText('Email already in use')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test:run -- src/components/auth/SignupForm.test.tsx
```

Expected: FAIL — `Cannot find module './SignupForm'`

- [ ] **Step 3: Create SignupForm**

Create `src/components/auth/SignupForm.tsx`:

```tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useTranslations, useLocale } from 'next-intl'
import { signup, loginWithGoogle } from '@/actions/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

export function SignupForm() {
  const t = useTranslations('auth')
  const locale = useLocale()
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function handleSubmit(formData: FormData) {
    setPending(true)
    setError(null)
    const result = await signup(formData)
    if (result?.error) setError(result.error)
    setPending(false)
  }

  async function handleGoogle() {
    setPending(true)
    await loginWithGoogle(locale)
    setPending(false)
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>{t('signupTitle')}</CardTitle>
        <CardDescription>{t('signupSubtitle')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={handleGoogle}
          disabled={pending}
        >
          {t('continueWithGoogle')}
        </Button>

        <div className="flex items-center gap-2">
          <Separator className="flex-1" />
          <span className="text-xs text-muted-foreground">{t('or')}</span>
          <Separator className="flex-1" />
        </div>

        <form action={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">{t('name')}</Label>
            <Input id="name" name="name" type="text" required autoComplete="name" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">{t('email')}</Label>
            <Input id="email" name="email" type="email" required autoComplete="email" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">{t('password')}</Label>
            <Input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={pending}>
            {t('signup')}
          </Button>
        </form>

        <p className="text-sm text-center text-muted-foreground">
          {t('hasAccount')}{' '}
          <Link href={`/${locale}/auth/login`} className="underline underline-offset-2">
            {t('login')}
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 4: Create signup page**

```bash
mkdir -p "src/app/[locale]/auth/signup"
```

Create `src/app/[locale]/auth/signup/page.tsx`:

```tsx
import { SignupForm } from '@/components/auth/SignupForm'

export default function SignupPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-16 flex justify-center">
      <SignupForm />
    </div>
  )
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npm run test:run -- src/components/auth/SignupForm.test.tsx
```

Expected: `2 passed`

- [ ] **Step 6: Commit**

```bash
git add src/components/auth/SignupForm.tsx src/components/auth/SignupForm.test.tsx "src/app/[locale]/auth/signup/"
git commit -m "feat: add signup page with name/email/password form and Google OAuth"
```

---

## Task 12: Profile Page

**Files:** `src/actions/profile.ts`, `src/app/[locale]/profile/page.tsx`
**Test:** `src/app/[locale]/profile/page.test.tsx`

- [ ] **Step 1: Write failing test**

Create `src/app/[locale]/profile/page.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import ProfilePage from './page'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'ko',
}))

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({ data: null }),
        })),
      })),
    })),
  }),
}))

vi.mock('@/actions/profile', () => ({
  updateProfile: vi.fn().mockResolvedValue({ success: true }),
}))

describe('ProfilePage', () => {
  it('renders profile title', () => {
    render(<ProfilePage />)
    expect(screen.getByText('profile.title')).toBeInTheDocument()
  })

  it('renders save button', () => {
    render(<ProfilePage />)
    expect(screen.getByRole('button', { name: 'profile.save' })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test:run -- "src/app/\[locale\]/profile/page.test.tsx"
```

Expected: FAIL — `Cannot find module './page'`

- [ ] **Step 3: Create profile server action**

Create `src/actions/profile.ts`:

```typescript
'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function updateProfile(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const name = formData.get('name') as string
  const preferred_locale = formData.get('preferred_locale') as string

  const { error } = await supabase
    .from('users')
    .update({ name, preferred_locale })
    .eq('id', user.id)

  if (error) return { error: error.message }

  revalidatePath('/[locale]/profile', 'page')
  return { success: true }
}
```

- [ ] **Step 4: Create profile page**

```bash
mkdir -p "src/app/[locale]/profile"
```

Create `src/app/[locale]/profile/page.tsx`:

```tsx
'use client'

import { useState, useEffect } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import { updateProfile } from '@/actions/profile'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export default function ProfilePage() {
  const t = useTranslations('profile')
  const locale = useLocale()
  const [name, setName] = useState('')
  const [preferredLocale, setPreferredLocale] = useState(locale)
  const [saved, setSaved] = useState(false)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return
      const { data } = await supabase
        .from('users')
        .select('name, preferred_locale')
        .eq('id', session.user.id)
        .single()
      if (data) {
        setName(data.name ?? '')
        setPreferredLocale(data.preferred_locale)
      }
    })
  }, [])

  async function handleSubmit(formData: FormData) {
    setPending(true)
    setSaved(false)
    formData.set('preferred_locale', preferredLocale)
    const result = await updateProfile(formData)
    if (result?.success) setSaved(true)
    setPending(false)
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">{t('title')}</h1>
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>{t('title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">이름 / Name / 名前</Label>
              <Input
                id="name"
                name="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{t('language')}</Label>
              <Select value={preferredLocale} onValueChange={setPreferredLocale}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ko">한국어</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="ja">日本語</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {saved && <p className="text-sm text-green-600">{t('saved')}</p>}
            <Button type="submit" disabled={pending}>
              {t('save')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npm run test:run -- "src/app/\[locale\]/profile/page.test.tsx"
```

Expected: `2 passed`

- [ ] **Step 6: Commit**

```bash
git add src/actions/profile.ts "src/app/[locale]/profile/"
git commit -m "feat: add profile page with name and language preference"
```

---

## Task 13: Final Verification

- [ ] **Step 1: Run full test suite**

```bash
npm run test:run
```

Expected: All tests pass, 0 failures.

- [ ] **Step 2: Start dev server**

```bash
npm run dev
```

Expected: Server running on http://localhost:3000, no console errors.

- [ ] **Step 3: Verify pages and routing**

Open browser and check:
- `http://localhost:3000` → redirects to `/ko`
- `/ko`, `/en`, `/ja` → landing page in correct language
- Language switcher in header switches language
- `/ko/auth/login` → login form renders
- `/ko/auth/signup` → signup form renders
- Header shows login/signup when not logged in

- [ ] **Step 4: Verify auth end-to-end**

1. Go to `/ko/auth/signup`, create account with email/password
2. On success → redirect to `/ko/dashboard` (404 for now — expected)
3. Check header shows credit badge with "5크레딧"
4. Go to `/ko/profile`, update name → save → "저장되었습니다" appears
5. Click logout → redirects to `/ko`, header shows login/signup again
6. Login again → credits still showing

- [ ] **Step 5: Verify Supabase trigger**

In Supabase Dashboard → Table Editor → `credits`:
- New row for test user with `balance = 5`

In `credit_transactions`:
- Row with `type = 'signup'`, `amount = 5`

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat: Plan 1 Foundation complete — Next.js 14, Supabase, Auth, i18n, base UI"
```
