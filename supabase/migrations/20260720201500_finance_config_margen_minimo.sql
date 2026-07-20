-- Margen mínimo por defecto (config global), usado por el motor de "precio
-- ideal" cuando un servicio no tiene su propio margen_objetivo configurado.
ALTER TABLE public.finance_config
  ADD COLUMN IF NOT EXISTS margen_minimo numeric NOT NULL DEFAULT 0.30;

ALTER TABLE public.finance_config
  DROP CONSTRAINT IF EXISTS finance_config_margen_minimo_valid;
ALTER TABLE public.finance_config
  ADD CONSTRAINT finance_config_margen_minimo_valid
  CHECK (margen_minimo > 0 AND margen_minimo < 1);
