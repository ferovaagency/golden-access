-- Umbral configurable para clasificar un cliente como "PÉRDIDA" en
-- HorasAdmin (antes: constante 0.75 hardcodeada, sin respaldo en Config --
-- ver docs/METRICS_CATALOG.md, sección de constantes sin respaldo).
ALTER TABLE public.finance_config
  ADD COLUMN IF NOT EXISTS umbral_perdida_horas numeric NOT NULL DEFAULT 0.75;

ALTER TABLE public.finance_config
  DROP CONSTRAINT IF EXISTS finance_config_umbral_perdida_horas_valid;
ALTER TABLE public.finance_config
  ADD CONSTRAINT finance_config_umbral_perdida_horas_valid
  CHECK (umbral_perdida_horas > 0 AND umbral_perdida_horas < 1);
