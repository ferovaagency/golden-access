-- H-P1: el allowlist interno no es un directorio público para todos los
-- usuarios autenticados. Cada persona solo puede confirmar su propia fila;
-- los procesos administrativos siguen usando service_role.
ALTER TABLE public.crm_team_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "team members read all" ON public.crm_team_members;
DROP POLICY IF EXISTS "team members read own membership" ON public.crm_team_members;
CREATE POLICY "team members read own membership"
  ON public.crm_team_members
  FOR SELECT TO authenticated
  USING (lower(email) = lower(COALESCE(auth.jwt() ->> 'email', '')));

-- Las funciones de trigger solo deben ser invocadas por sus triggers, nunca
-- como RPC desde el API expuesto.
REVOKE ALL ON FUNCTION public.handle_new_user_team() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user_courtesy() FROM PUBLIC, anon, authenticated;

-- Fija la resolución de objetos para las funciones de cron y elimina el
-- hallazgo `function_search_path_mutable` sin cambiar su comportamiento.
ALTER FUNCTION public.roll_forward_missed_planner_tasks() SET search_path = public, extensions;
ALTER FUNCTION public.complete_past_crm_citas() SET search_path = public, extensions;

-- El helper de RLS debe ser invoker: ve exclusivamente la fila permitida por
-- la política anterior y no eleva privilegios del usuario.
ALTER FUNCTION public.is_team_member() SECURITY INVOKER;
ALTER FUNCTION public.is_team_member() SET search_path = public;
REVOKE ALL ON FUNCTION public.is_team_member() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_team_member() TO authenticated, service_role;
