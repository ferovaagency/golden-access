-- Prueba de 7 días sin tarjeta (cardless trial de Paddle), oct 2026.
-- `trial_ends_at` marca hasta cuándo dura la prueba (la app muestra el aviso y
-- el botón de agregar tarjeta); `periodo` recuerda si se eligió mensual o anual.
-- Paddle cancela la suscripción sola al vencer la prueba sin método de pago y
-- el webhook pone la fila en 'cancelled'.
ALTER TABLE public.user_subscriptions
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS periodo text DEFAULT 'mensual';

COMMENT ON COLUMN public.user_subscriptions.trial_ends_at IS 'Fin de la prueba sin tarjeta. Null = no está en prueba (o ya pagó).';

-- Los planes nuevos (basico / intermedio / full) conviven con los legacy, que
-- siguen vigentes para quien ya los tenía. Sin esto, el upsert de la prueba
-- fallaba con el CHECK antiguo.
ALTER TABLE public.user_subscriptions DROP CONSTRAINT IF EXISTS user_subscriptions_plan_check;
ALTER TABLE public.user_subscriptions
  ADD CONSTRAINT user_subscriptions_plan_check
  CHECK (plan = ANY (ARRAY[
    'projects', 'finance', 'planner', 'crm', 'completo', 'custom', 'financiero', 'crm_ventas',
    'basico', 'intermedio', 'full'
  ]));

ALTER TABLE public.user_subscriptions
  ADD CONSTRAINT user_subscriptions_periodo_check CHECK (periodo IS NULL OR periodo IN ('mensual', 'anual'));
