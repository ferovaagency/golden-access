CREATE TABLE IF NOT EXISTS public.business_assistant_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  parts jsonb NOT NULL DEFAULT '[]'::jsonb,
  content text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_assistant_messages TO authenticated;
GRANT ALL ON public.business_assistant_messages TO service_role;

ALTER TABLE public.business_assistant_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage their assistant messages" ON public.business_assistant_messages;
CREATE POLICY "Users manage their assistant messages"
ON public.business_assistant_messages
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_business_assistant_messages_user_created
ON public.business_assistant_messages(user_id, created_at);

CREATE TABLE IF NOT EXISTS public.google_workspace_connections (
  user_id uuid PRIMARY KEY,
  access_token text,
  connected boolean NOT NULL DEFAULT false,
  scopes text[] NOT NULL DEFAULT '{}'::text[],
  expires_at timestamptz,
  connected_email text,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.google_workspace_connections TO authenticated;
GRANT ALL ON public.google_workspace_connections TO service_role;

ALTER TABLE public.google_workspace_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage their Google Workspace connection" ON public.google_workspace_connections;
CREATE POLICY "Users manage their Google Workspace connection"
ON public.google_workspace_connections
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_google_workspace_connections_updated_at ON public.google_workspace_connections;
CREATE TRIGGER update_google_workspace_connections_updated_at
BEFORE UPDATE ON public.google_workspace_connections
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE VIEW public.finance_service_profitability AS
SELECT
  v.user_id,
  s.id AS servicio_id,
  s.nombre AS servicio_nombre,
  COALESCE(SUM(v.cantidad * v.precio_venta_unitario), 0)::numeric AS ingresos_brutos,
  COALESCE(SUM(v.cantidad * v.costo_unitario), 0)::numeric AS costos_directos,
  COALESCE(SUM(v.cantidad * (v.precio_venta_unitario - v.costo_unitario)), 0)::numeric AS margen_bruto,
  COUNT(v.id)::integer AS ventas_count,
  COALESCE(SUM(h.horas), 0)::numeric AS horas_registradas
FROM public.finance_servicios s
LEFT JOIN public.finance_ventas v ON v.servicio_id = s.id AND v.user_id = s.user_id
LEFT JOIN public.finance_horas h ON h.servicio_id = s.id AND h.user_id = s.user_id
GROUP BY v.user_id, s.id, s.nombre;

GRANT SELECT ON public.finance_service_profitability TO authenticated;
GRANT ALL ON public.finance_service_profitability TO service_role;

CREATE OR REPLACE VIEW public.business_overview AS
SELECT
  fc.user_id,
  fc.trm,
  fc.meta_ventas_mensual,
  COALESCE((SELECT COUNT(*) FROM public.finance_clientes c WHERE c.user_id = fc.user_id AND c.activo), 0)::integer AS clientes_activos,
  COALESCE((SELECT SUM(v.cantidad * v.precio_venta_unitario) FROM public.finance_ventas v WHERE v.user_id = fc.user_id), 0)::numeric AS ventas_totales,
  COALESCE((SELECT SUM(v.cantidad * (v.precio_venta_unitario - v.costo_unitario)) FROM public.finance_ventas v WHERE v.user_id = fc.user_id), 0)::numeric AS margen_directo_total,
  COALESCE((SELECT SUM(g.monto) FROM public.finance_otros_gastos g WHERE g.user_id = fc.user_id), 0)::numeric AS gastos_operativos,
  COALESCE((SELECT SUM(p.monto) FROM public.finance_pagos_egresos p WHERE p.user_id = fc.user_id), 0)::numeric AS egresos_pagados,
  COALESCE((SELECT COUNT(*) FROM public.crm_oportunidades), 0)::integer AS oportunidades_total,
  COALESCE((SELECT SUM(valor_estimado) FROM public.crm_oportunidades WHERE estado NOT IN ('perdido')), 0)::numeric AS pipeline_estimado,
  COALESCE((SELECT COUNT(*) FROM public.crm_resenas WHERE respondida = false), 0)::integer AS resenas_sin_responder
FROM public.finance_config fc;

GRANT SELECT ON public.business_overview TO authenticated;
GRANT ALL ON public.business_overview TO service_role;

CREATE OR REPLACE VIEW public.crm_growth_overview AS
SELECT
  (SELECT COUNT(*) FROM public.crm_oportunidades)::integer AS oportunidades_total,
  (SELECT COUNT(*) FROM public.crm_oportunidades WHERE estado IN ('nuevo','contactado','calificando'))::integer AS oportunidades_abiertas,
  (SELECT COUNT(*) FROM public.crm_oportunidades WHERE estado = 'ganado')::integer AS oportunidades_ganadas,
  (SELECT COALESCE(SUM(valor_estimado), 0) FROM public.crm_oportunidades WHERE estado NOT IN ('perdido'))::numeric AS pipeline_estimado,
  (SELECT COUNT(*) FROM public.crm_citas_diagnostico WHERE estado NOT IN ('cancelada','no_asistio'))::integer AS citas_activas,
  (SELECT COUNT(*) FROM public.crm_contenido_potencial)::integer AS contenidos_analizados,
  (SELECT COUNT(*) FROM public.crm_resenas WHERE respondida = false)::integer AS resenas_sin_responder;

GRANT SELECT ON public.crm_growth_overview TO authenticated;
GRANT ALL ON public.crm_growth_overview TO service_role;