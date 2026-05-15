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
