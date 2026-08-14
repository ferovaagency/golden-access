-- 1) Bind team membership to a verified auth user id instead of a raw email claim
ALTER TABLE public.crm_team_members ADD COLUMN IF NOT EXISTS user_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS crm_team_members_user_id_key ON public.crm_team_members(user_id) WHERE user_id IS NOT NULL;

UPDATE public.crm_team_members tm
SET user_id = u.id
FROM auth.users u
WHERE tm.user_id IS NULL AND lower(u.email) = lower(tm.email);

ALTER TABLE public.collaborators ADD COLUMN IF NOT EXISTS user_id uuid;
UPDATE public.collaborators c
SET user_id = u.id
FROM auth.users u
WHERE c.user_id IS NULL AND lower(u.email) = lower(c.email);

-- 2) Identity checks now use auth.uid()
CREATE OR REPLACE FUNCTION public.is_team_member()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.crm_team_members tm
    WHERE tm.user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_collaborator_of(owner uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.collaborators c
    WHERE c.owner_user_id = owner AND c.activo AND c.user_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.is_team_member() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_team_member() TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.is_collaborator_of(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_collaborator_of(uuid) TO authenticated, service_role;

-- 3) Self-read policies keyed on auth.uid()
DROP POLICY IF EXISTS "team members read own membership" ON public.crm_team_members;
CREATE POLICY "team members read own membership" ON public.crm_team_members
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "collab_self_read" ON public.collaborators;
CREATE POLICY "collab_self_read" ON public.collaborators
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- 4) Bind new signups to pre-created team/collaborator invitations
CREATE OR REPLACE FUNCTION public.handle_new_user_team()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.crm_team_members LIMIT 1) THEN
    INSERT INTO public.crm_team_members (email, nombre, rol, user_id)
    VALUES (NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), 'owner', NEW.id);
  ELSE
    UPDATE public.crm_team_members
      SET user_id = NEW.id
    WHERE user_id IS NULL AND lower(email) = lower(NEW.email);
  END IF;

  UPDATE public.collaborators
    SET user_id = NEW.id
  WHERE user_id IS NULL AND lower(email) = lower(NEW.email);

  RETURN NEW;
END; $$;

-- 5) SECURITY DEFINER admin/server-only functions must not be callable from the API
REVOKE ALL ON FUNCTION public.admin_ai_usage_overview(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_ai_usage_overview(integer) TO service_role;
REVOKE ALL ON FUNCTION public.admin_subscriptions_overview() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_subscriptions_overview() TO service_role;
REVOKE ALL ON FUNCTION public.match_ferova_knowledge(text, uuid, integer, double precision) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.match_ferova_knowledge(text, uuid, integer, double precision) TO service_role;
REVOKE ALL ON FUNCTION public.handle_new_user_team() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user_courtesy() FROM PUBLIC, anon, authenticated;

-- 6) Tighten role targeting on shared reference/admin tables
DROP POLICY IF EXISTS "team writes plans" ON public.saas_plans;
CREATE POLICY "team writes plans" ON public.saas_plans
  FOR ALL TO authenticated
  USING (public.is_team_member())
  WITH CHECK (public.is_team_member());

DROP POLICY IF EXISTS "everyone reads plans" ON public.saas_plans;
CREATE POLICY "everyone reads plans" ON public.saas_plans
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "team manages courtesy" ON public.admin_courtesy_emails;
CREATE POLICY "team manages courtesy" ON public.admin_courtesy_emails
  FOR ALL TO authenticated
  USING (public.is_team_member())
  WITH CHECK (public.is_team_member());
