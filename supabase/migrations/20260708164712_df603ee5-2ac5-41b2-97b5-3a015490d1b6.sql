-- Fix missing Data API grants for existing app tables.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_config TO authenticated;
GRANT ALL ON public.finance_config TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_clientes TO authenticated;
GRANT ALL ON public.finance_clientes TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_servicios TO authenticated;
GRANT ALL ON public.finance_servicios TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_herramientas TO authenticated;
GRANT ALL ON public.finance_herramientas TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_herramienta_servicios TO authenticated;
GRANT ALL ON public.finance_herramienta_servicios TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_otros_gastos TO authenticated;
GRANT ALL ON public.finance_otros_gastos TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_pagos_egresos TO authenticated;
GRANT ALL ON public.finance_pagos_egresos TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_ventas TO authenticated;
GRANT ALL ON public.finance_ventas TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_abonos TO authenticated;
GRANT ALL ON public.finance_abonos TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_horas TO authenticated;
GRANT ALL ON public.finance_horas TO service_role;

GRANT SELECT ON public.crm_team_members TO authenticated;
GRANT ALL ON public.crm_team_members TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_oportunidades TO authenticated;
GRANT ALL ON public.crm_oportunidades TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_interacciones TO authenticated;
GRANT ALL ON public.crm_interacciones TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_citas_diagnostico TO authenticated;
GRANT ALL ON public.crm_citas_diagnostico TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_contenido_potencial TO authenticated;
GRANT ALL ON public.crm_contenido_potencial TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_bot_config TO authenticated;
GRANT ALL ON public.crm_bot_config TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_bot_knowledge TO authenticated;
GRANT ALL ON public.crm_bot_knowledge TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_resenas TO authenticated;
GRANT ALL ON public.crm_resenas TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_subscriptions TO authenticated;
GRANT ALL ON public.user_subscriptions TO service_role;

-- Review source/profile links managed inside CRM.
CREATE TABLE IF NOT EXISTS public.crm_review_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plataforma text NOT NULL,
  nombre text NOT NULL,
  profile_url text NOT NULL,
  gmail_query text,
  enabled boolean NOT NULL DEFAULT true,
  last_scanned_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plataforma, profile_url)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_review_sources TO authenticated;
GRANT ALL ON public.crm_review_sources TO service_role;

ALTER TABLE public.crm_review_sources ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'crm_review_sources'
      AND policyname = 'Team members manage review sources'
  ) THEN
    CREATE POLICY "Team members manage review sources"
      ON public.crm_review_sources
      FOR ALL
      TO authenticated
      USING (public.is_team_member())
      WITH CHECK (public.is_team_member());
  END IF;
END $$;

DROP TRIGGER IF EXISTS update_crm_review_sources_updated_at ON public.crm_review_sources;
CREATE TRIGGER update_crm_review_sources_updated_at
  BEFORE UPDATE ON public.crm_review_sources
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();