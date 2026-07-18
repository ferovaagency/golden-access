-- Soporte para importar leads del "Radar" de Sortlist (briefs de proyecto que
-- llegan por email) al pipeline, con el mismo patrón de deduplicación por
-- email_message_id que ya usa crm_resenas para las notificaciones de reseñas.
ALTER TABLE public.crm_oportunidades
  ADD COLUMN IF NOT EXISTS email_message_id text;

CREATE UNIQUE INDEX IF NOT EXISTS crm_oportunidades_email_message_id_key
  ON public.crm_oportunidades(email_message_id)
  WHERE email_message_id IS NOT NULL;

INSERT INTO public.crm_acquisition_channels (slug, label, color)
VALUES ('sortlist_radar', 'Sortlist (Radar)', '#0ea5e9')
ON CONFLICT (slug) DO NOTHING;
