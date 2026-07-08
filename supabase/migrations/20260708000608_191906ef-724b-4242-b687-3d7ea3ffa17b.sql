
-- ============================================================
-- HELPERS
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- ============================================================
-- FINANCE (por usuario)
-- ============================================================
CREATE TABLE public.finance_config (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  trm NUMERIC NOT NULL DEFAULT 4000,
  uvt NUMERIC NOT NULL DEFAULT 52374,
  smmlv NUMERIC NOT NULL DEFAULT 1750905,
  tope_no_declarante_uvt NUMERIC NOT NULL DEFAULT 1400,
  tope_no_paga_renta_uvt NUMERIC NOT NULL DEFAULT 1090,
  tope_responsable_iva_uvt NUMERIC NOT NULL DEFAULT 3500,
  retencion_servicio_min_uvt NUMERIC NOT NULL DEFAULT 4,
  tarifa_ret_declarante NUMERIC NOT NULL DEFAULT 0.04,
  tarifa_ret_no_declarante NUMERIC NOT NULL DEFAULT 0.06,
  tarifa_salud NUMERIC NOT NULL DEFAULT 0.125,
  tarifa_pension NUMERIC NOT NULL DEFAULT 0.16,
  ibc_porcentaje NUMERIC NOT NULL DEFAULT 0.40,
  tarifa_iva NUMERIC NOT NULL DEFAULT 0.19,
  salario_propuesto NUMERIC NOT NULL DEFAULT 4000000,
  horas_objetivo_mes NUMERIC NOT NULL DEFAULT 160,
  meta_ventas_mensual NUMERIC NOT NULL DEFAULT 12000000,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_config TO authenticated;
GRANT ALL ON public.finance_config TO service_role;
ALTER TABLE public.finance_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "finance_config own" ON public.finance_config FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.finance_clientes (
  id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  tipo TEXT NOT NULL,
  declarante BOOLEAN NOT NULL DEFAULT false,
  activo BOOLEAN NOT NULL DEFAULT true,
  fecha_creacion TEXT NOT NULL,
  notas TEXT, marca_info TEXT, objetivos TEXT, kpis TEXT, entregables TEXT,
  progreso NUMERIC, responsable TEXT,
  PRIMARY KEY (user_id, id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_clientes TO authenticated;
GRANT ALL ON public.finance_clientes TO service_role;
ALTER TABLE public.finance_clientes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "finance_clientes own" ON public.finance_clientes FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.finance_servicios (
  id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  costo_unitario NUMERIC NOT NULL DEFAULT 0,
  descripcion TEXT,
  PRIMARY KEY (user_id, id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_servicios TO authenticated;
GRANT ALL ON public.finance_servicios TO service_role;
ALTER TABLE public.finance_servicios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "finance_servicios own" ON public.finance_servicios FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.finance_herramientas (
  id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  monto NUMERIC NOT NULL DEFAULT 0,
  moneda TEXT NOT NULL DEFAULT 'COP',
  tipo_cobro TEXT NOT NULL DEFAULT 'global',
  notas TEXT,
  PRIMARY KEY (user_id, id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_herramientas TO authenticated;
GRANT ALL ON public.finance_herramientas TO service_role;
ALTER TABLE public.finance_herramientas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "finance_herramientas own" ON public.finance_herramientas FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.finance_herramienta_servicios (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  herramienta_id TEXT NOT NULL,
  servicio_id TEXT NOT NULL,
  PRIMARY KEY (user_id, herramienta_id, servicio_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_herramienta_servicios TO authenticated;
GRANT ALL ON public.finance_herramienta_servicios TO service_role;
ALTER TABLE public.finance_herramienta_servicios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "finance_herramienta_servicios own" ON public.finance_herramienta_servicios FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.finance_otros_gastos (
  id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  monto NUMERIC NOT NULL DEFAULT 0,
  moneda TEXT NOT NULL DEFAULT 'COP',
  categoria TEXT NOT NULL DEFAULT 'Operativo',
  PRIMARY KEY (user_id, id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_otros_gastos TO authenticated;
GRANT ALL ON public.finance_otros_gastos TO service_role;
ALTER TABLE public.finance_otros_gastos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "finance_otros_gastos own" ON public.finance_otros_gastos FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.finance_pagos_egresos (
  id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fecha TEXT NOT NULL,
  concepto TEXT NOT NULL,
  categoria TEXT NOT NULL,
  monto NUMERIC NOT NULL DEFAULT 0,
  moneda TEXT NOT NULL DEFAULT 'COP',
  metodo_pago TEXT,
  notas TEXT,
  PRIMARY KEY (user_id, id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_pagos_egresos TO authenticated;
GRANT ALL ON public.finance_pagos_egresos TO service_role;
ALTER TABLE public.finance_pagos_egresos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "finance_pagos_egresos own" ON public.finance_pagos_egresos FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.finance_ventas (
  id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fecha TEXT NOT NULL,
  cliente_id TEXT NOT NULL,
  servicio_id TEXT NOT NULL,
  cantidad NUMERIC NOT NULL DEFAULT 1,
  precio_venta_unitario NUMERIC NOT NULL DEFAULT 0,
  costo_unitario NUMERIC NOT NULL DEFAULT 0,
  moneda TEXT NOT NULL DEFAULT 'COP',
  tipo TEXT NOT NULL DEFAULT 'Nacional',
  adelanto NUMERIC NOT NULL DEFAULT 0,
  estado_pago TEXT NOT NULL DEFAULT 'Pendiente',
  notas TEXT,
  PRIMARY KEY (user_id, id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_ventas TO authenticated;
GRANT ALL ON public.finance_ventas TO service_role;
ALTER TABLE public.finance_ventas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "finance_ventas own" ON public.finance_ventas FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.finance_abonos (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  venta_id TEXT NOT NULL,
  fecha TEXT NOT NULL,
  monto NUMERIC NOT NULL DEFAULT 0,
  tipo_pago TEXT,
  notas TEXT,
  PRIMARY KEY (user_id, id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_abonos TO authenticated;
GRANT ALL ON public.finance_abonos TO service_role;
ALTER TABLE public.finance_abonos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "finance_abonos own" ON public.finance_abonos FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.finance_horas (
  id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fecha TEXT NOT NULL,
  cliente_id TEXT NOT NULL,
  servicio_id TEXT NOT NULL,
  horas NUMERIC NOT NULL DEFAULT 0,
  descripcion TEXT,
  PRIMARY KEY (user_id, id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_horas TO authenticated;
GRANT ALL ON public.finance_horas TO service_role;
ALTER TABLE public.finance_horas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "finance_horas own" ON public.finance_horas FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- CRM (compartido por el equipo, allowlist por email)
-- ============================================================
CREATE TABLE public.crm_team_members (
  email TEXT PRIMARY KEY,
  nombre TEXT,
  rol TEXT NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.crm_team_members TO authenticated;
GRANT ALL ON public.crm_team_members TO service_role;
ALTER TABLE public.crm_team_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "team members read all" ON public.crm_team_members FOR SELECT TO authenticated USING (true);

-- Helper: ¿el usuario actual es miembro del equipo?
CREATE OR REPLACE FUNCTION public.is_team_member()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.crm_team_members tm
    WHERE tm.email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );
$$;

CREATE TABLE public.crm_oportunidades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre_contacto TEXT NOT NULL,
  empresa TEXT,
  canal_origen TEXT NOT NULL DEFAULT 'otro',
  estado TEXT NOT NULL DEFAULT 'nuevo',
  servicio_id TEXT,
  valor_estimado NUMERIC,
  moneda TEXT,
  probabilidad NUMERIC,
  fuente_url TEXT,
  telefono TEXT,
  email TEXT,
  notas TEXT,
  siguiente_accion TEXT,
  fecha_siguiente_accion TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_oportunidades TO authenticated;
GRANT ALL ON public.crm_oportunidades TO service_role;
ALTER TABLE public.crm_oportunidades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "team crm_oportunidades" ON public.crm_oportunidades FOR ALL TO authenticated
  USING (public.is_team_member()) WITH CHECK (public.is_team_member());
CREATE TRIGGER trg_crm_oportunidades_updated BEFORE UPDATE ON public.crm_oportunidades
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.crm_interacciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  oportunidad_id UUID NOT NULL REFERENCES public.crm_oportunidades(id) ON DELETE CASCADE,
  canal TEXT NOT NULL,
  tipo TEXT NOT NULL,
  contenido TEXT,
  enlace TEXT,
  ocurrido_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by TEXT
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_interacciones TO authenticated;
GRANT ALL ON public.crm_interacciones TO service_role;
ALTER TABLE public.crm_interacciones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "team crm_interacciones" ON public.crm_interacciones FOR ALL TO authenticated
  USING (public.is_team_member()) WITH CHECK (public.is_team_member());

CREATE TABLE public.crm_citas_diagnostico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  oportunidad_id UUID REFERENCES public.crm_oportunidades(id) ON DELETE SET NULL,
  nombre_prospecto TEXT NOT NULL,
  email_prospecto TEXT,
  telefono_prospecto TEXT,
  fecha_hora TIMESTAMPTZ NOT NULL,
  duracion_min INTEGER NOT NULL DEFAULT 30,
  estado TEXT NOT NULL DEFAULT 'agendada',
  es_pagada BOOLEAN NOT NULL DEFAULT false,
  monto NUMERIC,
  moneda TEXT,
  calendar_event_id TEXT,
  meet_link TEXT,
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_citas_diagnostico TO authenticated;
GRANT ALL ON public.crm_citas_diagnostico TO service_role;
ALTER TABLE public.crm_citas_diagnostico ENABLE ROW LEVEL SECURITY;
CREATE POLICY "team crm_citas" ON public.crm_citas_diagnostico FOR ALL TO authenticated
  USING (public.is_team_member()) WITH CHECK (public.is_team_member());

CREATE TABLE public.crm_contenido_potencial (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plataforma TEXT NOT NULL DEFAULT 'linkedin',
  url_publicacion TEXT NOT NULL,
  autor TEXT,
  resumen TEXT,
  score_potencial NUMERIC,
  razon TEXT,
  comentario_sugerido TEXT,
  estado TEXT NOT NULL DEFAULT 'nuevo',
  detectado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_contenido_potencial TO authenticated;
GRANT ALL ON public.crm_contenido_potencial TO service_role;
ALTER TABLE public.crm_contenido_potencial ENABLE ROW LEVEL SECURITY;
CREATE POLICY "team crm_contenido" ON public.crm_contenido_potencial FOR ALL TO authenticated
  USING (public.is_team_member()) WITH CHECK (public.is_team_member());

-- Singleton (id boolean = true). El código usa .eq('id', true).
CREATE TABLE public.crm_bot_config (
  id BOOLEAN PRIMARY KEY DEFAULT true CHECK (id = true),
  bot_enabled BOOLEAN NOT NULL DEFAULT false,
  custom_prompt TEXT,
  instance_name TEXT NOT NULL DEFAULT 'ferova',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO public.crm_bot_config (id) VALUES (true);
GRANT SELECT, INSERT, UPDATE ON public.crm_bot_config TO authenticated;
GRANT ALL ON public.crm_bot_config TO service_role;
ALTER TABLE public.crm_bot_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "team crm_bot_config" ON public.crm_bot_config FOR ALL TO authenticated
  USING (public.is_team_member()) WITH CHECK (public.is_team_member());

CREATE TABLE public.crm_bot_knowledge (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT NOT NULL,
  source TEXT,
  embedding TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_bot_knowledge TO authenticated;
GRANT ALL ON public.crm_bot_knowledge TO service_role;
ALTER TABLE public.crm_bot_knowledge ENABLE ROW LEVEL SECURITY;
CREATE POLICY "team crm_bot_knowledge" ON public.crm_bot_knowledge FOR ALL TO authenticated
  USING (public.is_team_member()) WITH CHECK (public.is_team_member());

-- ============================================================
-- SUSCRIPCIONES (PayPal paywall)
-- ============================================================
CREATE TABLE public.user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('active','cancelled','pending')),
  provider TEXT NOT NULL DEFAULT 'paypal',
  provider_order_id TEXT,
  amount_usd NUMERIC(10,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ
);
CREATE INDEX user_subscriptions_user_id_idx ON public.user_subscriptions(user_id);
GRANT SELECT, INSERT, UPDATE ON public.user_subscriptions TO authenticated;
GRANT ALL ON public.user_subscriptions TO service_role;
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sub own read" ON public.user_subscriptions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "sub own insert" ON public.user_subscriptions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- Auto-registro del primer usuario como team owner
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user_team()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.crm_team_members LIMIT 1) THEN
    INSERT INTO public.crm_team_members (email, nombre, rol)
    VALUES (NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), 'owner');
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created_team
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_team();
