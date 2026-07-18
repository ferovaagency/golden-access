CREATE TABLE IF NOT EXISTS public.crm_acquisition_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  label text NOT NULL,
  color text NOT NULL DEFAULT '#64748b',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_acquisition_channels TO authenticated;
GRANT ALL ON public.crm_acquisition_channels TO service_role;
ALTER TABLE public.crm_acquisition_channels ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "team crm_acquisition_channels" ON public.crm_acquisition_channels;
CREATE POLICY "team crm_acquisition_channels" ON public.crm_acquisition_channels
  FOR ALL TO authenticated USING (public.is_team_member()) WITH CHECK (public.is_team_member());

INSERT INTO public.crm_acquisition_channels (slug, label, color) VALUES
  ('linkedin','LinkedIn','#2563eb'), ('whatsapp','WhatsApp','#16a34a'),
  ('email','Email','#7c3aed'), ('reddit','Reddit','#ea580c'),
  ('web','Sitio web','#0891b2'), ('googlemaps','Google Maps','#dc2626'),
  ('referido','Referido','#ca8a04'), ('otro','Otro','#64748b')
ON CONFLICT (slug) DO NOTHING;

ALTER TABLE public.crm_oportunidades
  ADD COLUMN IF NOT EXISTS vendedor text,
  ADD COLUMN IF NOT EXISTS comision_porcentaje numeric(7,3),
  ADD COLUMN IF NOT EXISTS comision_valor numeric(14,2);

ALTER TABLE public.crm_oportunidades
  DROP CONSTRAINT IF EXISTS crm_oportunidades_comision_porcentaje_check;
ALTER TABLE public.crm_oportunidades
  ADD CONSTRAINT crm_oportunidades_comision_porcentaje_check
  CHECK (comision_porcentaje IS NULL OR (comision_porcentaje >= 0 AND comision_porcentaje <= 100));

COMMENT ON COLUMN public.crm_oportunidades.comision_valor IS
  'Comisión calculada o pactada para el vendedor. Puede reemplazar el cálculo porcentual.';
