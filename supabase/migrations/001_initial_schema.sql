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

-- Prompt versions
CREATE TABLE public.prompt_versions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  version text NOT NULL UNIQUE,
  content text NOT NULL,
  is_active boolean DEFAULT false,
  traffic_ratio integer DEFAULT 0 CHECK (traffic_ratio BETWEEN 0 AND 100),
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

-- RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analysis_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recommendation_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prompt_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_rw" ON public.users FOR ALL USING (auth.uid() = id);
CREATE POLICY "analyses_own_rw" ON public.analyses FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "results_own_read" ON public.analysis_results FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.analyses a WHERE a.id = analysis_results.analysis_id AND a.user_id = auth.uid())
);
CREATE POLICY "ratings_own_rw" ON public.recommendation_ratings FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "credits_own_rw" ON public.credits FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "transactions_own_read" ON public.credit_transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "plans_public_read" ON public.plans FOR SELECT USING (is_active = true);

-- Trigger: auto-create user profile + 5 credits on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.users (id, email, name, avatar_url)
  VALUES (new.id, new.email, new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'avatar_url')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.credits (user_id, balance) VALUES (new.id, 5) ON CONFLICT (user_id) DO NOTHING;
  INSERT INTO public.credit_transactions (user_id, amount, type) VALUES (new.id, 5, 'signup');
  RETURN new;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

INSERT INTO public.plans (name_ko, name_en, name_ja, credits, price, sort_order) VALUES
  ('베이직', 'Basic', 'ベーシック', 10, 2900, 1),
  ('스탠다드', 'Standard', 'スタンダード', 30, 6900, 2),
  ('프리미엄', 'Premium', 'プレミアム', 100, 19900, 3);
