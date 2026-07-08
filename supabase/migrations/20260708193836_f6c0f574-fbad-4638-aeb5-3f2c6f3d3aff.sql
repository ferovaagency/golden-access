ALTER TABLE public.crm_oportunidades
  ADD COLUMN IF NOT EXISTS memoria_resumen text,
  ADD COLUMN IF NOT EXISTS memoria_updated_at timestamptz;

ALTER TABLE public.crm_interacciones
  ADD COLUMN IF NOT EXISTS whatsapp_message_id text,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.crm_citas_diagnostico
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual';

CREATE UNIQUE INDEX IF NOT EXISTS uniq_crm_citas_calendar_event_id
ON public.crm_citas_diagnostico(calendar_event_id)
WHERE calendar_event_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_crm_interacciones_whatsapp_message_id
ON public.crm_interacciones(whatsapp_message_id)
WHERE whatsapp_message_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.crm_whatsapp_instances (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  instance_name text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'disconnected',
  qr_code text,
  pairing_code text,
  connected_phone text,
  last_error text,
  connected_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_whatsapp_instances TO authenticated;
GRANT ALL ON public.crm_whatsapp_instances TO service_role;

ALTER TABLE public.crm_whatsapp_instances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Team users manage own WhatsApp instance" ON public.crm_whatsapp_instances;
CREATE POLICY "Team users manage own WhatsApp instance"
ON public.crm_whatsapp_instances
FOR ALL
TO authenticated
USING (auth.uid() = user_id AND public.is_team_member())
WITH CHECK (auth.uid() = user_id AND public.is_team_member());

DROP TRIGGER IF EXISTS update_crm_whatsapp_instances_updated_at ON public.crm_whatsapp_instances;
CREATE TRIGGER update_crm_whatsapp_instances_updated_at
BEFORE UPDATE ON public.crm_whatsapp_instances
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();