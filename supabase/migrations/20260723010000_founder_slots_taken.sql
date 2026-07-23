-- Contador real de cupos Founder para la landing publica.
-- Expone UN solo entero (suscripciones activas), nada de PII: la landing es
-- anonima y user_subscriptions tiene RLS por dueno, asi que el conteo se hace
-- via SECURITY DEFINER con search_path fijado, igual que las demas funciones.
CREATE OR REPLACE FUNCTION public.founder_slots_taken()
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT count(*)::integer FROM public.user_subscriptions WHERE status = 'active';
$$;

REVOKE ALL ON FUNCTION public.founder_slots_taken() FROM public;
GRANT EXECUTE ON FUNCTION public.founder_slots_taken() TO anon, authenticated;
