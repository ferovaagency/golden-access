CREATE TABLE public.workspace_accounts (id uuid PRIMARY KEY, owner_user_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.workspace_accounts TO authenticated;
GRANT ALL ON public.workspace_accounts TO service_role;
ALTER TABLE public.workspace_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workspace accounts accessible" ON public.workspace_accounts FOR SELECT TO authenticated USING (id IN (SELECT account_id FROM public.my_accessible_account_ids()));
INSERT INTO public.workspace_accounts (id, owner_user_id) SELECT id, id FROM auth.users ON CONFLICT DO NOTHING;
ALTER TABLE public.organizations ADD COLUMN managed_account_id uuid REFERENCES public.workspace_accounts(id);
-- Each self-managed company receives its own data identity; no synthetic Auth users.
INSERT INTO public.workspace_accounts (id, owner_user_id)
SELECT o.id, o.created_by FROM public.organizations o JOIN auth.users u ON u.id=o.created_by
WHERE o.parent_org_id IS NOT NULL AND o.data_user_id IS NULL AND (o.invite_email IS NULL OR lower(trim(o.invite_email))=lower(u.email)) ON CONFLICT DO NOTHING;
UPDATE public.organizations o SET managed_account_id=o.id, data_user_id=o.id, invite_email=NULL
WHERE o.parent_org_id IS NOT NULL AND o.data_user_id IS NULL AND EXISTS (SELECT 1 FROM public.workspace_accounts a WHERE a.id=o.id);
-- Only tenant data references move to the account registry. Auth actors, billing and notifications keep their current references.
DO $$ DECLARE r record; BEGIN
FOR r IN SELECT c.conrelid::regclass AS tbl,c.conname FROM pg_constraint c JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=ANY(c.conkey)
WHERE c.contype='f' AND c.confrelid='auth.users'::regclass AND c.connamespace='public'::regnamespace AND a.attname='user_id'
AND (EXISTS (SELECT 1 FROM pg_policies p WHERE p.schemaname='public' AND p.tablename=(SELECT relname FROM pg_class WHERE oid=c.conrelid) AND (p.qual LIKE '%current_account_id%' OR p.with_check LIKE '%current_account_id%')) OR c.conrelid='public.crm_whatsapp_instances'::regclass)
LOOP
EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I',r.tbl,r.conname);
EXECUTE format('ALTER TABLE %s ADD CONSTRAINT %I FOREIGN KEY (user_id) REFERENCES public.workspace_accounts(id) ON DELETE CASCADE',r.tbl,r.conname);
END LOOP; END $$;
CREATE OR REPLACE FUNCTION public.register_workspace_account() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
INSERT INTO public.workspace_accounts(id,owner_user_id) VALUES(NEW.id,NEW.id) ON CONFLICT DO NOTHING; RETURN NEW; END $$;
REVOKE ALL ON FUNCTION public.register_workspace_account() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER a_register_workspace_account AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.register_workspace_account();
CREATE OR REPLACE FUNCTION public.create_organization(p_nombre text, p_parent_org_id uuid DEFAULT NULL, p_invite_email text DEFAULT NULL, p_vincular_mi_cuenta boolean DEFAULT false, p_comparte_por_defecto boolean DEFAULT false)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_id uuid:=gen_random_uuid(); v_email text:=nullif(lower(trim(p_invite_email)),''); v_me text; v_managed boolean; v_data uuid;
BEGIN
IF auth.uid() IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
IF coalesce(trim(p_nombre),'')='' THEN RAISE EXCEPTION 'La organización necesita un nombre'; END IF;
IF p_parent_org_id IS NOT NULL AND NOT public.can_admin_org(p_parent_org_id) THEN RAISE EXCEPTION 'Sin permiso sobre la organización padre'; END IF;
SELECT lower(email) INTO v_me FROM auth.users WHERE id=auth.uid();
v_managed:=p_parent_org_id IS NOT NULL AND NOT p_vincular_mi_cuenta AND (v_email IS NULL OR v_email=v_me);
IF v_managed THEN
INSERT INTO public.workspace_accounts(id,owner_user_id) VALUES(v_id,auth.uid()); v_data:=v_id; v_email:=NULL;
ELSIF p_vincular_mi_cuenta THEN
IF v_email IS NOT NULL AND v_email<>v_me THEN RAISE EXCEPTION 'Una organización vincula tu cuenta o invita a otra'; END IF;
IF EXISTS(SELECT 1 FROM public.organizations WHERE data_user_id=auth.uid()) THEN RAISE EXCEPTION 'Tu empresa principal ya está vinculada; añade una empresa gestionada por ti'; END IF;
v_data:=auth.uid(); v_email:=NULL;
ELSIF v_email IS NOT NULL THEN
SELECT u.id INTO v_data FROM auth.users u WHERE lower(u.email)=v_email AND NOT EXISTS(SELECT 1 FROM public.organizations o WHERE o.data_user_id=u.id) LIMIT 1;
IF v_data IS NULL AND EXISTS(SELECT 1 FROM auth.users WHERE lower(email)=v_email) THEN
INSERT INTO public.workspace_accounts(id,owner_user_id) VALUES(v_id,auth.uid()); v_data:=v_id; v_managed:=true;
END IF;
END IF;
INSERT INTO public.organizations(id,nombre,parent_org_id,data_user_id,managed_account_id,invite_email,comparte_por_defecto,created_by)
VALUES(v_id,trim(p_nombre),p_parent_org_id,v_data,CASE WHEN v_managed THEN v_id END,v_email,p_comparte_por_defecto,auth.uid());
INSERT INTO public.organization_members(org_id,user_id,rol) VALUES(v_id,auth.uid(),'owner') ON CONFLICT DO NOTHING;
IF v_email IS NOT NULL THEN
PERFORM public.share_organization(v_id,v_email,'admin','{}'::jsonb);
END IF;
RETURN v_id; END $$;
REVOKE ALL ON FUNCTION public.create_organization(text,uuid,text,boolean,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_organization(text,uuid,text,boolean,boolean) TO authenticated,service_role;