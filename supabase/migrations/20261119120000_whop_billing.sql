-- Cobro con Whop (nov 2026) y planes Gratis / Medio / Pro.
--
-- 1. user_subscriptions acepta los planes nuevos `medio` y `pro`. Los de oct
--    2026 (basico / intermedio / full) y los anteriores siguen válidos para
--    quien ya los tiene.
-- 2. billing_webhook_events: registro idempotente de webhooks por proveedor
--    (Whop reintenta hasta ~71 h y puede repetir entregas). Sólo lo toca el
--    service role desde la edge function; nadie lo lee desde el navegador.
-- 3. billing_user_id_by_email: el webhook de Whop identifica al comprador por
--    correo cuando la compra no trae el id de Supabase en los metadatos (p. ej.
--    alguien que compró desde un enlace de afiliado en whop.com). Sólo el
--    service role puede ejecutarla.

ALTER TABLE public.user_subscriptions DROP CONSTRAINT IF EXISTS user_subscriptions_plan_check;
ALTER TABLE public.user_subscriptions
  ADD CONSTRAINT user_subscriptions_plan_check
  CHECK (plan = ANY (ARRAY[
    'projects', 'finance', 'planner', 'crm', 'completo', 'custom', 'financiero', 'crm_ventas',
    'basico', 'intermedio', 'full',
    'medio', 'pro'
  ]));

-- Funciones por plan mínimo (panel de admin → Funciones): también Medio y Pro.
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.feature_flags'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%plan_minimo%'
  LOOP
    EXECUTE format('ALTER TABLE public.feature_flags DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;
ALTER TABLE public.feature_flags
  ADD CONSTRAINT feature_flags_plan_minimo_check
  CHECK (plan_minimo IS NULL OR plan_minimo IN ('basico', 'intermedio', 'full', 'medio', 'pro'));

CREATE TABLE IF NOT EXISTS public.billing_webhook_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  provider text NOT NULL,
  event_id text NOT NULL,
  event_type text NOT NULL,
  -- received | processed | ignored | unmatched (comprador sin cuenta en Ferova)
  outcome text NOT NULL DEFAULT 'received',
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, event_id)
);

ALTER TABLE public.billing_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_webhook_events FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.billing_webhook_events FROM anon, authenticated;
GRANT ALL ON public.billing_webhook_events TO service_role;

CREATE INDEX IF NOT EXISTS billing_webhook_events_outcome_idx
  ON public.billing_webhook_events (provider, outcome, created_at DESC);

COMMENT ON TABLE public.billing_webhook_events IS
  'Webhooks de cobro recibidos (Whop). Idempotencia por (provider, event_id). outcome=unmatched: pago sin cuenta de Ferova con ese correo; revisar desde admin.';

CREATE OR REPLACE FUNCTION public.billing_user_id_by_email(p_email text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT u.id
  FROM auth.users u
  WHERE lower(u.email) = lower(trim(p_email))
  ORDER BY u.created_at
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.billing_user_id_by_email(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.billing_user_id_by_email(text) TO service_role;
