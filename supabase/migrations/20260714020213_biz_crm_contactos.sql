-- CRM y Ventas propio de cada cliente pyme (multi-tenant, por user_id).
-- Deliberadamente independiente del CRM interno de Ferova (crm_*, global,
-- gestionado en /admin con WhatsApp/Apollo propios de Ferova): esta es una
-- herramienta de venta simple, sin integraciones externas, que cada negocio
-- usa para su propio pipeline. Mismo patron de PK que finance_* (id texto,
-- generado en el cliente, no uuid).
CREATE TABLE public.biz_crm_contactos (
  id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre_contacto TEXT NOT NULL,
  empresa TEXT,
  telefono TEXT,
  email TEXT,
  estado TEXT NOT NULL DEFAULT 'nuevo' CHECK (estado IN ('nuevo', 'contactado', 'negociacion', 'ganado', 'perdido')),
  valor_estimado NUMERIC,
  moneda TEXT NOT NULL DEFAULT 'COP',
  notas TEXT,
  proxima_accion TEXT,
  fecha_proxima_accion DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.biz_crm_contactos TO authenticated;
GRANT ALL ON public.biz_crm_contactos TO service_role;
ALTER TABLE public.biz_crm_contactos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "biz_crm_contactos own" ON public.biz_crm_contactos FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
