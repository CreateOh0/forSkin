-- ============================================================
-- 003_fix_schema.sql
-- Fixes:
--   1. analyses: add AI token usage columns (worker writes these)
--   2. credit_transactions: add 'admin' to type CHECK constraint
--   3. adjust_credit RPC for admin credit adjustment
--   4. REVOKE EXECUTE on SECURITY DEFINER credit functions from PUBLIC
-- ============================================================

-- 1. Add token/cost columns to analyses
ALTER TABLE public.analyses
  ADD COLUMN IF NOT EXISTS input_tokens  integer,
  ADD COLUMN IF NOT EXISTS output_tokens integer,
  ADD COLUMN IF NOT EXISTS estimated_cost_usd numeric(10, 6);

-- 2. Fix credit_transactions.type CHECK to include 'admin'
ALTER TABLE public.credit_transactions
  DROP CONSTRAINT IF EXISTS credit_transactions_type_check;

ALTER TABLE public.credit_transactions
  ADD CONSTRAINT credit_transactions_type_check
  CHECK (type IN ('signup','purchase','rating','streak','referral','analysis','refund','admin'));

-- 3. adjust_credit RPC (admin-only; called via service_role client)
CREATE OR REPLACE FUNCTION public.adjust_credit(
  p_user_id    uuid,
  p_delta      integer,
  p_admin_note text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_delta = 0 THEN
    RAISE EXCEPTION 'Delta must be non-zero';
  END IF;

  -- credits.balance has CHECK (balance >= 0); negative delta will fail naturally
  UPDATE credits
  SET balance = balance + p_delta
  WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User % has no credits row', p_user_id;
  END IF;

  INSERT INTO credit_transactions (user_id, amount, type, admin_note)
  VALUES (p_user_id, p_delta, 'admin', p_admin_note);
END;
$$;

-- 4. Lock down SECURITY DEFINER credit functions
--    anon and authenticated roles must not call these directly.
--    Only service_role (used by worker + admin actions) may execute.
-- REVOKE FROM PUBLIC first, then from individual roles Supabase pre-grants
REVOKE EXECUTE ON FUNCTION public.deduct_credit(uuid, uuid)          FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.refund_credit(uuid, uuid)          FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.adjust_credit(uuid, integer, text) FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.deduct_credit(uuid, uuid)          FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.refund_credit(uuid, uuid)          FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.adjust_credit(uuid, integer, text) FROM anon, authenticated;

GRANT EXECUTE ON FUNCTION public.deduct_credit(uuid, uuid)          TO service_role;
GRANT EXECUTE ON FUNCTION public.refund_credit(uuid, uuid)          TO service_role;
GRANT EXECUTE ON FUNCTION public.adjust_credit(uuid, integer, text) TO service_role;
