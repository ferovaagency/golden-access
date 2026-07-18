-- Consolidates access plans without breaking existing subscriptions. Legacy
-- identifiers remain valid while the frontend and admin portal migrate.
DO $$
DECLARE constraint_name text;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'public.user_subscriptions'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%plan%'
  LIMIT 1;
  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.user_subscriptions DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;
ALTER TABLE public.user_subscriptions
  ADD CONSTRAINT user_subscriptions_plan_check
  CHECK (plan IN ('projects', 'finance', 'planner', 'crm', 'completo', 'custom', 'financiero', 'crm_ventas'));

DO $$
DECLARE constraint_name text;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'public.courtesy_access_grants'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%plan%'
  LIMIT 1;
  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.courtesy_access_grants DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;
ALTER TABLE public.courtesy_access_grants
  ADD CONSTRAINT courtesy_access_grants_plan_check
  CHECK (plan IN ('projects', 'finance', 'planner', 'crm', 'completo', 'custom', 'financiero', 'crm_ventas'));

-- Migrate existing invitations once, then stop exposing the old invitation
-- table to authenticated clients. courtesy_access_grants is the sole runtime
-- source of truth for free access.
INSERT INTO public.courtesy_access_grants (email, plan, notas, granted_by)
SELECT lower(email), plan, notas, 'legacy-admin-courtesy-emails'
FROM public.admin_courtesy_emails
ON CONFLICT (email) DO NOTHING;

REVOKE ALL ON public.admin_courtesy_emails FROM authenticated;

CREATE OR REPLACE FUNCTION public.handle_new_user_courtesy()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_plan text;
BEGIN
  SELECT plan INTO v_plan
  FROM public.courtesy_access_grants
  WHERE lower(email) = lower(NEW.email);

  IF v_plan IS NOT NULL THEN
    INSERT INTO public.user_subscriptions (user_id, status, provider, amount_usd, plan)
    VALUES (NEW.id, 'active', 'courtesy', 0, v_plan)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END; $$;

-- Remove OAuth access tokens left by the former client-side architecture.
-- Edge Functions must own future encrypted credential storage; authenticated
-- browser clients no longer have any database grant on this table.
UPDATE public.google_workspace_connections
SET access_token = NULL
WHERE access_token IS NOT NULL;
REVOKE ALL ON public.google_workspace_connections FROM authenticated;
