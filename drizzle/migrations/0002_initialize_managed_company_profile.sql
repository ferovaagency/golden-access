CREATE OR REPLACE FUNCTION public.initialize_managed_company_profile() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
IF NEW.managed_account_id IS NOT NULL THEN
INSERT INTO public.business_profile(user_id,nombre_negocio,onboarding_completado) VALUES(NEW.managed_account_id,NEW.nombre,true) ON CONFLICT(user_id) DO NOTHING;
END IF; RETURN NEW; END $$;
REVOKE ALL ON FUNCTION public.initialize_managed_company_profile() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER initialize_managed_company_profile AFTER INSERT ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.initialize_managed_company_profile();