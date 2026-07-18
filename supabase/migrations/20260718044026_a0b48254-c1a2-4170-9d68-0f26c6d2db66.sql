
-- 1. Planner blocks: consolidar is_locked -> protected
UPDATE public.planner_blocks SET protected = TRUE WHERE is_locked = TRUE AND protected = FALSE;
ALTER TABLE public.planner_blocks DROP COLUMN IF EXISTS is_locked;

-- 2. saas_plans: agregar precios provisionales COP y códigos estables
ALTER TABLE public.saas_plans
  ADD COLUMN IF NOT EXISTS code TEXT,
  ADD COLUMN IF NOT EXISTS price_cop_monthly NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS price_cop_yearly NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'COP';

UPDATE public.saas_plans SET code = id WHERE code IS NULL;

-- Precios provisionales por spec
UPDATE public.saas_plans SET price_cop_monthly = 49900, price_cop_yearly = 499000 WHERE code = 'finance';
UPDATE public.saas_plans SET price_cop_monthly = 39900, price_cop_yearly = 399000 WHERE code = 'planner';
UPDATE public.saas_plans SET price_cop_monthly = 49900, price_cop_yearly = 499000 WHERE code = 'crm';
UPDATE public.saas_plans SET price_cop_monthly = 99900, price_cop_yearly = 999000, nombre = 'Business OS Completo' WHERE code = 'completo';

-- Add-ons
INSERT INTO public.saas_plans (id, code, nombre, descripcion, precio_usd, price_cop_monthly, price_cop_yearly, currency, provisional, activo, modulos, orden)
VALUES
  ('modulo_adicional', 'modulo_adicional', 'Módulo adicional', 'Se suma a cualquier plan.', 0, 29900, 299000, 'COP', TRUE, TRUE, '[]'::jsonb, 10),
  ('usuario_adicional', 'usuario_adicional', 'Usuario adicional', 'Añade un miembro al workspace.', 0, 19900, 199000, 'COP', TRUE, TRUE, '[]'::jsonb, 11)
ON CONFLICT (id) DO UPDATE SET
  code = EXCLUDED.code,
  nombre = EXCLUDED.nombre,
  descripcion = EXCLUDED.descripcion,
  price_cop_monthly = EXCLUDED.price_cop_monthly,
  price_cop_yearly = EXCLUDED.price_cop_yearly,
  currency = EXCLUDED.currency,
  orden = EXCLUDED.orden;

CREATE UNIQUE INDEX IF NOT EXISTS saas_plans_code_key ON public.saas_plans(code);

-- 3. product_feedback (nueva)
CREATE TABLE IF NOT EXISTS public.product_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email TEXT,
  tipo TEXT NOT NULL CHECK (tipo IN ('bug','sugerencia','otro')),
  mensaje TEXT NOT NULL,
  estado TEXT NOT NULL DEFAULT 'abierto' CHECK (estado IN ('abierto','en_revision','resuelto')),
  admin_response TEXT,
  resolved_at TIMESTAMPTZ,
  resolved_by TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.product_feedback TO authenticated;
GRANT ALL ON public.product_feedback TO service_role;

ALTER TABLE public.product_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "feedback owner reads" ON public.product_feedback;
CREATE POLICY "feedback owner reads" ON public.product_feedback FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_team_member());

DROP POLICY IF EXISTS "feedback owner inserts" ON public.product_feedback;
CREATE POLICY "feedback owner inserts" ON public.product_feedback FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "feedback team updates" ON public.product_feedback;
CREATE POLICY "feedback team updates" ON public.product_feedback FOR UPDATE TO authenticated
  USING (public.is_team_member())
  WITH CHECK (public.is_team_member());

CREATE INDEX IF NOT EXISTS product_feedback_user_idx ON public.product_feedback(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS product_feedback_estado_idx ON public.product_feedback(estado, created_at DESC);

CREATE TRIGGER product_feedback_updated
  BEFORE UPDATE ON public.product_feedback
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
