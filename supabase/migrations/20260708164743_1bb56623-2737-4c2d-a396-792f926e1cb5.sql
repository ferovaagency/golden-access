CREATE OR REPLACE FUNCTION public.is_team_member()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.crm_team_members tm
    WHERE lower(tm.email) = lower(COALESCE(auth.jwt() ->> 'email', ''))
  );
$function$;

GRANT EXECUTE ON FUNCTION public.is_team_member() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_team_member() TO service_role;