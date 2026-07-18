
-- FASE 1: PERFIL FISCAL
CREATE TABLE IF NOT EXISTS public.user_fiscal_profile (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  country text NOT NULL DEFAULT 'CO',
  person_type text NOT NULL DEFAULT 'natural' CHECK (person_type IN ('natural','juridica')),
  regime text NOT NULL DEFAULT 'simple' CHECK (regime IN ('simple','ordinario')),
  currency_base text NOT NULL DEFAULT 'COP',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_fiscal_profile TO authenticated;
GRANT ALL ON public.user_fiscal_profile TO service_role;
ALTER TABLE public.user_fiscal_profile ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own fiscal profile" ON public.user_fiscal_profile FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_user_fiscal_profile_updated BEFORE UPDATE ON public.user_fiscal_profile FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ADMIN SAAS
CREATE TABLE IF NOT EXISTS public.admin_module_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, module)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_module_overrides TO authenticated;
GRANT ALL ON public.admin_module_overrides TO service_role;
ALTER TABLE public.admin_module_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user reads own overrides" ON public.admin_module_overrides FOR SELECT USING (auth.uid() = user_id OR public.is_team_member());
CREATE POLICY "team manages overrides" ON public.admin_module_overrides FOR ALL USING (public.is_team_member()) WITH CHECK (public.is_team_member());
CREATE TRIGGER trg_admin_overrides_updated BEFORE UPDATE ON public.admin_module_overrides FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.admin_courtesy_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  plan text NOT NULL DEFAULT 'completo',
  notas text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_courtesy_emails TO authenticated;
GRANT ALL ON public.admin_courtesy_emails TO service_role;
ALTER TABLE public.admin_courtesy_emails ENABLE ROW LEVEL SECURITY;
CREATE POLICY "team manages courtesy" ON public.admin_courtesy_emails FOR ALL USING (public.is_team_member()) WITH CHECK (public.is_team_member());

INSERT INTO public.admin_courtesy_emails (email, plan, notas) VALUES ('gerencia@seoparaecommerce.co', 'completo', 'Admin principal') ON CONFLICT (email) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.saas_plans (
  id text PRIMARY KEY,
  nombre text NOT NULL,
  descripcion text,
  precio_usd numeric(10,2) NOT NULL DEFAULT 0,
  provisional boolean NOT NULL DEFAULT true,
  activo boolean NOT NULL DEFAULT true,
  modulos jsonb NOT NULL DEFAULT '[]'::jsonb,
  orden int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.saas_plans TO authenticated, anon;
GRANT ALL ON public.saas_plans TO service_role;
ALTER TABLE public.saas_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "everyone reads plans" ON public.saas_plans FOR SELECT USING (true);
CREATE POLICY "team writes plans" ON public.saas_plans FOR ALL USING (public.is_team_member()) WITH CHECK (public.is_team_member());
CREATE TRIGGER trg_saas_plans_updated BEFORE UPDATE ON public.saas_plans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.saas_plans (id, nombre, descripcion, precio_usd, modulos, orden) VALUES
  ('projects','Proyectos','Módulo base de proyectos.',15,'["projects"]'::jsonb,1),
  ('finance','Finanzas','Finanzas operativas completas.',25,'["projects","finance"]'::jsonb,2),
  ('planner','Planner','Smart Planner con IA.',20,'["projects","planner"]'::jsonb,3),
  ('crm','Ventas / CRM','Pipeline, contactos y automatizaciones.',25,'["projects","crm"]'::jsonb,4),
  ('completo','Todo incluido','Acceso completo a Ferova OS.',50,'["projects","finance","planner","crm","marketing"]'::jsonb,5),
  ('custom','Personalizado','Elegí los módulos que necesitás.',0,'[]'::jsonb,6)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.saas_user_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  module text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_saas_events_user ON public.saas_user_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_saas_events_type ON public.saas_user_events(event_type, created_at DESC);
GRANT SELECT, INSERT ON public.saas_user_events TO authenticated;
GRANT ALL ON public.saas_user_events TO service_role;
ALTER TABLE public.saas_user_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user reads own events" ON public.saas_user_events FOR SELECT USING (auth.uid() = user_id OR public.is_team_member());
CREATE POLICY "user inserts own events" ON public.saas_user_events FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.handle_new_user_courtesy()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_plan text;
BEGIN
  SELECT plan INTO v_plan FROM public.admin_courtesy_emails WHERE lower(email) = lower(NEW.email);
  IF v_plan IS NOT NULL THEN
    INSERT INTO public.user_subscriptions (user_id, status, provider, amount_usd)
    VALUES (NEW.id, 'active', 'courtesy', 0);
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS on_auth_user_created_courtesy ON auth.users;
CREATE TRIGGER on_auth_user_created_courtesy AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_courtesy();

-- FASE 2: FINANZAS OPERATIVAS
CREATE TABLE IF NOT EXISTS public.finance_payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('credito','debito','efectivo','transferencia','otro')),
  activo boolean NOT NULL DEFAULT true,
  notas text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pm_user ON public.finance_payment_methods(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_payment_methods TO authenticated;
GRANT ALL ON public.finance_payment_methods TO service_role;
ALTER TABLE public.finance_payment_methods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own payment methods" ON public.finance_payment_methods FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_pm_updated BEFORE UPDATE ON public.finance_payment_methods FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.finance_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('banco','efectivo','tarjeta_credito','credito_prestamo')),
  saldo_inicial numeric(14,2) NOT NULL DEFAULT 0,
  moneda text NOT NULL DEFAULT 'COP',
  cupo numeric(14,2),
  corte_dia int,
  pago_dia int,
  activo boolean NOT NULL DEFAULT true,
  notas text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_accounts_user ON public.finance_accounts(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_accounts TO authenticated;
GRANT ALL ON public.finance_accounts TO service_role;
ALTER TABLE public.finance_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own accounts" ON public.finance_accounts FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_accounts_updated BEFORE UPDATE ON public.finance_accounts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.finance_debts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id uuid REFERENCES public.finance_accounts(id) ON DELETE SET NULL,
  nombre text NOT NULL,
  saldo_inicial numeric(14,2) NOT NULL,
  tasa numeric(6,4),
  cuotas int,
  fecha_corte date,
  fecha_limite date,
  estado text NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo','pagado','en_mora','cancelado')),
  moneda text NOT NULL DEFAULT 'COP',
  notas text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_debts_user ON public.finance_debts(user_id, estado);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_debts TO authenticated;
GRANT ALL ON public.finance_debts TO service_role;
ALTER TABLE public.finance_debts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own debts" ON public.finance_debts FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_debts_updated BEFORE UPDATE ON public.finance_debts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.finance_debt_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  debt_id uuid NOT NULL REFERENCES public.finance_debts(id) ON DELETE CASCADE,
  fecha date NOT NULL,
  monto numeric(14,2) NOT NULL,
  payment_method_id uuid REFERENCES public.finance_payment_methods(id) ON DELETE SET NULL,
  notas text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_debt_pay_user ON public.finance_debt_payments(user_id, fecha DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_debt_payments TO authenticated;
GRANT ALL ON public.finance_debt_payments TO service_role;
ALTER TABLE public.finance_debt_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own debt payments" ON public.finance_debt_payments FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.finance_receivables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cliente_id text,
  factura text,
  concepto text NOT NULL,
  valor numeric(14,2) NOT NULL,
  moneda text NOT NULL DEFAULT 'COP',
  vencimiento date,
  estado text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','parcial','pagada','vencida','cancelada')),
  notas text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_recv_user ON public.finance_receivables(user_id, estado, vencimiento);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_receivables TO authenticated;
GRANT ALL ON public.finance_receivables TO service_role;
ALTER TABLE public.finance_receivables ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own receivables" ON public.finance_receivables FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_recv_updated BEFORE UPDATE ON public.finance_receivables FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.finance_receivable_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receivable_id uuid NOT NULL REFERENCES public.finance_receivables(id) ON DELETE CASCADE,
  fecha date NOT NULL,
  monto numeric(14,2) NOT NULL,
  payment_method_id uuid REFERENCES public.finance_payment_methods(id) ON DELETE SET NULL,
  account_id uuid REFERENCES public.finance_accounts(id) ON DELETE SET NULL,
  notas text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_receivable_payments TO authenticated;
GRANT ALL ON public.finance_receivable_payments TO service_role;
ALTER TABLE public.finance_receivable_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own recv payments" ON public.finance_receivable_payments FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.finance_payables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  proveedor text NOT NULL,
  factura text,
  concepto text,
  valor numeric(14,2) NOT NULL,
  moneda text NOT NULL DEFAULT 'COP',
  vencimiento date,
  fecha_pago_real date,
  monto_pagado numeric(14,2),
  payment_method_id uuid REFERENCES public.finance_payment_methods(id) ON DELETE SET NULL,
  account_id uuid REFERENCES public.finance_accounts(id) ON DELETE SET NULL,
  estado text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','pagada','vencida','cancelada')),
  notas text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pay_user ON public.finance_payables(user_id, estado, vencimiento);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_payables TO authenticated;
GRANT ALL ON public.finance_payables TO service_role;
ALTER TABLE public.finance_payables ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own payables" ON public.finance_payables FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_payables_updated BEFORE UPDATE ON public.finance_payables FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.finance_budget_monthly (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  periodo text NOT NULL,
  categoria text NOT NULL,
  monto_presupuestado numeric(14,2) NOT NULL DEFAULT 0,
  moneda text NOT NULL DEFAULT 'COP',
  origen text NOT NULL DEFAULT 'manual' CHECK (origen IN ('auto','manual')),
  notas text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, periodo, categoria)
);
CREATE INDEX IF NOT EXISTS idx_budget_user_periodo ON public.finance_budget_monthly(user_id, periodo);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_budget_monthly TO authenticated;
GRANT ALL ON public.finance_budget_monthly TO service_role;
ALTER TABLE public.finance_budget_monthly ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own budget" ON public.finance_budget_monthly FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_budget_updated BEFORE UPDATE ON public.finance_budget_monthly FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- FASE 3: SERVICIOS AMPLIADOS
ALTER TABLE public.finance_servicios
  ADD COLUMN IF NOT EXISTS incluye text,
  ADD COLUMN IF NOT EXISTS no_incluye text,
  ADD COLUMN IF NOT EXISTS precio_habitual numeric(14,2),
  ADD COLUMN IF NOT EXISTS precio_ofrecido numeric(14,2),
  ADD COLUMN IF NOT EXISTS costo_entrega_estimado numeric(14,2),
  ADD COLUMN IF NOT EXISTS margen_objetivo numeric(5,4),
  ADD COLUMN IF NOT EXISTS market_reference_notes text;

-- FASE 4: MARKETING ROI
CREATE TABLE IF NOT EXISTS public.marketing_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  canal text,
  cliente_id text,
  fecha_inicio date,
  fecha_fin date,
  account_id uuid REFERENCES public.finance_accounts(id) ON DELETE SET NULL,
  payment_method_id uuid REFERENCES public.finance_payment_methods(id) ON DELETE SET NULL,
  moneda text NOT NULL DEFAULT 'COP',
  estado text NOT NULL DEFAULT 'activa' CHECK (estado IN ('planificada','activa','pausada','finalizada')),
  notas text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mk_user ON public.marketing_campaigns(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_campaigns TO authenticated;
GRANT ALL ON public.marketing_campaigns TO service_role;
ALTER TABLE public.marketing_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own campaigns" ON public.marketing_campaigns FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_mk_updated BEFORE UPDATE ON public.marketing_campaigns FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.marketing_campaign_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES public.marketing_campaigns(id) ON DELETE CASCADE,
  periodo text NOT NULL,
  inversion numeric(14,2) NOT NULL DEFAULT 0,
  impresiones bigint NOT NULL DEFAULT 0,
  clics bigint NOT NULL DEFAULT 0,
  leads int NOT NULL DEFAULT 0,
  leads_calificados int NOT NULL DEFAULT 0,
  citas int NOT NULL DEFAULT 0,
  citas_efectivas int NOT NULL DEFAULT 0,
  ventas int NOT NULL DEFAULT 0,
  ticket_promedio numeric(14,2) NOT NULL DEFAULT 0,
  costo_entrega numeric(14,2) NOT NULL DEFAULT 0,
  comision numeric(14,2) NOT NULL DEFAULT 0,
  ltv numeric(14,2) NOT NULL DEFAULT 0,
  notas text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mkm_user ON public.marketing_campaign_metrics(user_id, campaign_id, periodo);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_campaign_metrics TO authenticated;
GRANT ALL ON public.marketing_campaign_metrics TO service_role;
ALTER TABLE public.marketing_campaign_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own campaign metrics" ON public.marketing_campaign_metrics FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_mkm_updated BEFORE UPDATE ON public.marketing_campaign_metrics FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- FASE 5: PLANNER BLOQUES PROTEGIDOS
ALTER TABLE public.planner_blocks ADD COLUMN IF NOT EXISTS protected boolean NOT NULL DEFAULT false;
