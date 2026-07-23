-- Costos reales de recaudo por venta. Todos los importes fijos se guardan en
-- la moneda original de la venta; trm_conversion conserva la tasa efectiva.
ALTER TABLE public.finance_ventas
  ADD COLUMN IF NOT EXISTS pasarela_pago text,
  ADD COLUMN IF NOT EXISTS comision_pasarela_porcentaje numeric NOT NULL DEFAULT 0 CHECK (comision_pasarela_porcentaje >= 0 AND comision_pasarela_porcentaje <= 100),
  ADD COLUMN IF NOT EXISTS comision_pasarela_fija numeric NOT NULL DEFAULT 0 CHECK (comision_pasarela_fija >= 0),
  ADD COLUMN IF NOT EXISTS comision_retiro numeric NOT NULL DEFAULT 0 CHECK (comision_retiro >= 0),
  ADD COLUMN IF NOT EXISTS trm_conversion numeric CHECK (trm_conversion IS NULL OR trm_conversion > 0);

COMMENT ON COLUMN public.finance_ventas.pasarela_pago IS 'Pasarela o medio por el que se recibió el dinero.';
COMMENT ON COLUMN public.finance_ventas.trm_conversion IS 'Tasa COP efectiva aplicada a una venta en USD.';

-- Reafirma el aislamiento de esta tabla aunque la migración inicial se haya
-- aplicado parcialmente en un entorno antiguo.
ALTER TABLE public.finance_ventas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "finance_ventas own" ON public.finance_ventas;
CREATE POLICY "finance_ventas own" ON public.finance_ventas
  FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
