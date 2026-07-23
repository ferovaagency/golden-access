-- 1) Catálogo de pasarelas de pago por usuario. Las comisiones no son iguales
-- para toda venta/servicio/cliente, así que se definen varias y se elige una
-- al registrar el ingreso. Los importes fijos se guardan en la moneda en la
-- que la pasarela los cobra realmente (p.ej. PayPal cobra USD 0.30).
CREATE TABLE IF NOT EXISTS public.payment_gateways (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  comision_porcentaje numeric NOT NULL DEFAULT 0 CHECK (comision_porcentaje >= 0 AND comision_porcentaje <= 100),
  comision_fija numeric NOT NULL DEFAULT 0 CHECK (comision_fija >= 0),
  comision_retiro numeric NOT NULL DEFAULT 0 CHECK (comision_retiro >= 0),
  moneda text NOT NULL DEFAULT 'COP' CHECK (moneda IN ('COP', 'USD')),
  aplica_cambio_moneda boolean NOT NULL DEFAULT false,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_gateways_user ON public.payment_gateways(user_id, activo);
ALTER TABLE public.payment_gateways ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "payment_gateways own" ON public.payment_gateways;
CREATE POLICY "payment_gateways own" ON public.payment_gateways
  FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- 2) Registro diario de KPIs. Antes vivía en localStorage (un solo dispositivo);
-- ahora se sincroniza. PK compuesta para que "guardar el día" sea un upsert.
CREATE TABLE IF NOT EXISTS public.operating_kpi_days (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fecha date NOT NULL,
  contactos integer NOT NULL DEFAULT 0 CHECK (contactos >= 0),
  seguimientos integer NOT NULL DEFAULT 0 CHECK (seguimientos >= 0),
  calificadas integer NOT NULL DEFAULT 0 CHECK (calificadas >= 0),
  respuestas integer NOT NULL DEFAULT 0 CHECK (respuestas >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, fecha)
);

ALTER TABLE public.operating_kpi_days ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "operating_kpi_days own" ON public.operating_kpi_days;
CREATE POLICY "operating_kpi_days own" ON public.operating_kpi_days
  FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- 3) Metas del tablero (metas diarias por KPI + meta anual O10).
CREATE TABLE IF NOT EXISTS public.operating_kpi_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  metas jsonb NOT NULL DEFAULT '{"contactos":20,"seguimientos":10,"calificadas":5,"respuestas":8}'::jsonb,
  meta_anual_mrr numeric NOT NULL DEFAULT 0 CHECK (meta_anual_mrr >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.operating_kpi_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "operating_kpi_settings own" ON public.operating_kpi_settings;
CREATE POLICY "operating_kpi_settings own" ON public.operating_kpi_settings
  FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
