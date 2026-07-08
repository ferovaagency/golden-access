
REVOKE ALL ON FUNCTION public.is_team_member() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_team_member() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.handle_new_user_team() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user_team() TO service_role, supabase_auth_admin;
