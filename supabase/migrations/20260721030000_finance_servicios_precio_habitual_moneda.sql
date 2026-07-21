-- Moneda del precio de referencia de venta (precio_habitual). Sin esto, un
-- servicio cobrado en USD se comparaba como si fuera COP en Equilibrio por
-- Servicio.
ALTER TABLE public.finance_servicios
  ADD COLUMN IF NOT EXISTS precio_habitual_moneda text NOT NULL DEFAULT 'COP';

ALTER TABLE public.finance_servicios
  DROP CONSTRAINT IF EXISTS finance_servicios_precio_habitual_moneda_valid;
ALTER TABLE public.finance_servicios
  ADD CONSTRAINT finance_servicios_precio_habitual_moneda_valid
  CHECK (precio_habitual_moneda IN ('COP', 'USD'));
