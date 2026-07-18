-- Base para convertir Ferova OS en una plataforma multi-tenant vendible a pymes:
-- planes/modulos, perfil de negocio (para onboarding), feedback de producto,
-- y acceso de cortesia (distinto del allowlist crm_team_members, que es
-- exclusivamente para el equipo interno de Ferova).

-- ============================================================
-- Plan del cliente (deriva que modulos ve: Financiero+Proyectos,
-- CRM y Ventas, o ambos con "completo")
-- ============================================================
ALTER TABLE public.user_subscriptions
  ADD COLUMN plan TEXT NOT NULL DEFAULT 'financiero'
  CHECK (plan IN ('financiero', 'crm_ventas', 'completo'));

-- ============================================================
-- Perfil de negocio (se llena en el onboarding con IA la primera
-- vez que un cliente entra despues de pagar)
-- ============================================================
CREATE TABLE public.business_profile (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre_negocio TEXT,
  industria TEXT,
  tipo_negocio TEXT,
  tamano_equipo TEXT,
  ciudad TEXT,
  telefono_contacto TEXT,
  onboarding_completado BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.business_profile TO authenticated;
GRANT ALL ON public.business_profile TO service_role;
ALTER TABLE public.business_profile ENABLE ROW LEVEL SECURITY;
CREATE POLICY "business_profile own" ON public.business_profile FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- Historial del chat de onboarding (separado de business_assistant_messages,
-- que es el asesor financiero/gerencial de uso continuo)
-- ============================================================
CREATE TABLE public.onboarding_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  parts JSONB NOT NULL DEFAULT '[]'::jsonb,
  content TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX onboarding_messages_user_id_idx ON public.onboarding_messages(user_id, created_at);
GRANT SELECT, INSERT ON public.onboarding_messages TO authenticated;
GRANT ALL ON public.onboarding_messages TO service_role;
ALTER TABLE public.onboarding_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "onboarding_messages own" ON public.onboarding_messages FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- Feedback de producto (bugs/sugerencias de los clientes pyme)
-- ============================================================
CREATE TABLE public.product_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  tipo TEXT NOT NULL DEFAULT 'sugerencia' CHECK (tipo IN ('bug', 'sugerencia', 'otro')),
  mensaje TEXT NOT NULL,
  estado TEXT NOT NULL DEFAULT 'nuevo' CHECK (estado IN ('nuevo', 'revisado', 'resuelto')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX product_feedback_user_id_idx ON public.product_feedback(user_id);
GRANT SELECT, INSERT ON public.product_feedback TO authenticated;
GRANT ALL ON public.product_feedback TO service_role;
ALTER TABLE public.product_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "product_feedback own read" ON public.product_feedback FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "product_feedback own insert" ON public.product_feedback FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
-- Sin policy de UPDATE para authenticated: solo el equipo de Ferova cambia el
-- estado, vía una Edge Function con service_role (portal de administracion).

-- ============================================================
-- Acceso de cortesia -- deliberadamente SEPARADO de crm_team_members (esa
-- tabla es el allowlist del equipo interno de Ferova y ademas da acceso al
-- CRM interno de prospeccion; mezclarla daria acceso indebido a un cliente
-- real). Se resuelve por email para cubrir tanto clientes ya registrados
-- como los que aun no se han registrado.
-- ============================================================
CREATE TABLE public.courtesy_access_grants (
  email TEXT PRIMARY KEY,
  plan TEXT NOT NULL DEFAULT 'completo' CHECK (plan IN ('financiero', 'crm_ventas', 'completo')),
  notas TEXT,
  granted_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Solo se escribe desde una Edge Function con service_role (portal de
-- administracion). La lectura si se permite al propio cliente autenticado,
-- pero acotada por RLS a su propio email (via auth.email()) -- asi
-- resolveAccess() puede resolverse en el cliente sin necesitar una Edge
-- Function nueva solo para leer si tiene cortesia.
GRANT SELECT ON public.courtesy_access_grants TO authenticated;
GRANT ALL ON public.courtesy_access_grants TO service_role;
ALTER TABLE public.courtesy_access_grants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "courtesy_access_grants own email read" ON public.courtesy_access_grants FOR SELECT TO authenticated
  USING (email = auth.email());
