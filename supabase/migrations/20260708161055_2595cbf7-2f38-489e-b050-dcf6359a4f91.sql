
ALTER TABLE public.crm_oportunidades
  ADD COLUMN IF NOT EXISTS apollo_data jsonb,
  ADD COLUMN IF NOT EXISTS apollo_enriched_at timestamptz,
  ADD COLUMN IF NOT EXISTS playbook_email text,
  ADD COLUMN IF NOT EXISTS playbook_linkedin_conectar boolean,
  ADD COLUMN IF NOT EXISTS playbook_linkedin_nota text,
  ADD COLUMN IF NOT EXISTS playbook_linkedin_mensaje text,
  ADD COLUMN IF NOT EXISTS playbook_whatsapp_mensaje text,
  ADD COLUMN IF NOT EXISTS playbook_generated_at timestamptz;
