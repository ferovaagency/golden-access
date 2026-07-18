ALTER TABLE public.marketing_campaign_metrics
  ADD COLUMN IF NOT EXISTS costo_profesional numeric(14,2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.marketing_campaign_metrics.costo_profesional IS
  'Honorarios totales del profesional o equipo que ejecutó la campaña durante el periodo.';
