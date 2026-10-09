DROP POLICY IF EXISTS "sub own insert" ON public.user_subscriptions;
REVOKE INSERT, UPDATE, DELETE ON public.user_subscriptions FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.handle_new_user_courtesy()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_plan text;
BEGIN
  IF NEW.email_confirmed_at IS NULL THEN RETURN NEW; END IF;
  SELECT plan INTO v_plan FROM public.courtesy_access_grants WHERE lower(email) = lower(NEW.email);
  IF v_plan IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.user_subscriptions s WHERE s.user_id = NEW.id AND s.provider = 'courtesy') THEN
    INSERT INTO public.user_subscriptions (user_id, status, provider, amount_usd, plan)
    VALUES (NEW.id, 'active', 'courtesy', 0, v_plan) ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END; $function$;

DROP TRIGGER IF EXISTS on_auth_user_confirmed_courtesy ON auth.users;
CREATE TRIGGER on_auth_user_confirmed_courtesy
AFTER UPDATE OF email_confirmed_at ON auth.users
FOR EACH ROW WHEN (OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL)
EXECUTE FUNCTION public.handle_new_user_courtesy();