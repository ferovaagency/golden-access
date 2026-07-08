
CREATE TABLE public.crm_resenas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plataforma TEXT NOT NULL,
  calificacion NUMERIC,
  texto TEXT,
  resenador TEXT,
  link TEXT,
  respondida BOOLEAN NOT NULL DEFAULT false,
  email_message_id TEXT,
  email_subject TEXT,
  email_from TEXT,
  detectada_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX crm_resenas_email_message_id_key ON public.crm_resenas(email_message_id) WHERE email_message_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_resenas TO authenticated;
GRANT ALL ON public.crm_resenas TO service_role;

ALTER TABLE public.crm_resenas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members manage resenas" ON public.crm_resenas
  FOR ALL TO authenticated
  USING (public.is_team_member())
  WITH CHECK (public.is_team_member());

CREATE TRIGGER update_crm_resenas_updated_at
  BEFORE UPDATE ON public.crm_resenas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
