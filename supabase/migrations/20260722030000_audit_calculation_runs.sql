-- Fase 7 del manual (Apendice A.3): infraestructura minima de auditoria e IA con evidencia.
-- NO se implementa el modelo completo de A.3 (tenants/users/business_profiles/etc.) porque
-- esta app es de un solo negocio por proyecto Supabase (patron ya establecido: cada tabla
-- financiera usa user_id + RLS "auth.uid() = user_id", no multi-tenant real) -- remodelar
-- eso seria un cambio estructural grande, fuera de alcance sin decision explicita.
-- Estas dos tablas cubren exactamente lo que Fase 7 pide: "evidencia, confianza y auditoria
-- en cada accion" para sugerencias/acciones de IA, sin tocar el resto del modelo.

CREATE TABLE IF NOT EXISTS public.calculation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  calculation_type text NOT NULL, -- p.ej. 'break_even', 'weighted_receivable', 'healthy_hourly_rate'
  formula_version text NOT NULL DEFAULT 'manual_maestro_v1',
  inputs jsonb NOT NULL DEFAULT '{}'::jsonb,
  outputs jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_calculation_runs_user_type ON public.calculation_runs(user_id, calculation_type, created_at DESC);

ALTER TABLE public.calculation_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "calculation_runs own" ON public.calculation_runs;
CREATE POLICY "calculation_runs own" ON public.calculation_runs
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entity_type text NOT NULL, -- p.ej. 'planner_task', 'receivable', 'service_price'
  entity_id text,
  actor text NOT NULL DEFAULT 'ai' CHECK (actor IN ('ai', 'user', 'system')),
  action text NOT NULL, -- p.ej. 'sugerido', 'aplicado', 'descartado', 'revertido'
  description text NOT NULL,
  confidence numeric CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  previous_value jsonb,
  new_value jsonb,
  status text NOT NULL DEFAULT 'sugerido' CHECK (status IN ('sugerido', 'aplicado', 'descartado', 'revertido')),
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_audit_log_user_status ON public.audit_log(user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON public.audit_log(entity_type, entity_id);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_log own" ON public.audit_log;
CREATE POLICY "audit_log own" ON public.audit_log
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
