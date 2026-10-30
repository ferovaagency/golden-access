-- Panel de Funciones (oct 2026): cada función nueva nace "interno" (solo el
-- equipo Ferova la ve), pasa a "beta" (equipo + correos elegidos) y luego a
-- "publicado" (todos, respetando el plan). Se cambia desde Administración sin
-- deploy. Las tablas no se leen directo desde el cliente: la app pregunta por
-- my_features() y el servidor valida con feature_enabled_for().

CREATE TABLE IF NOT EXISTS public.feature_flags (
  key text PRIMARY KEY CHECK (key ~ '^[a-z0-9_]{2,40}$'),
  nombre text NOT NULL,
  descripcion text,
  estado text NOT NULL DEFAULT 'interno' CHECK (estado IN ('interno', 'beta', 'publicado')),
  plan_minimo text CHECK (plan_minimo IS NULL OR plan_minimo IN ('basico', 'intermedio', 'full')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text
);

CREATE TABLE IF NOT EXISTS public.feature_flag_users (
  flag_key text NOT NULL REFERENCES public.feature_flags(key) ON DELETE CASCADE,
  email text NOT NULL,
  added_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (flag_key, email)
);

-- Bitácora: de qué estado a cuál, por quién y por qué (control de cambios).
CREATE TABLE IF NOT EXISTS public.feature_flag_changes (
  id bigserial PRIMARY KEY,
  flag_key text NOT NULL,
  de text,
  a text NOT NULL,
  motivo text,
  por text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_flag_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_flag_changes ENABLE ROW LEVEL SECURITY;
-- Sin políticas: ni anon ni authenticated leen o escriben directo. Solo el
-- service role (edge functions) y las funciones SECURITY DEFINER de abajo.
REVOKE ALL ON public.feature_flags, public.feature_flag_users, public.feature_flag_changes FROM anon, authenticated;

-- ¿La cuenta que pregunta tiene habilitada esta función?
CREATE OR REPLACE FUNCTION public.feature_enabled_for(p_key text, p_user uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  f record;
  v_email text;
BEGIN
  SELECT * INTO f FROM public.feature_flags WHERE key = p_key;
  IF NOT FOUND THEN RETURN false; END IF;
  SELECT email INTO v_email FROM auth.users WHERE id = p_user;
  IF v_email IS NULL THEN RETURN false; END IF;
  -- El equipo Ferova ve todo, en cualquier estado.
  IF EXISTS (SELECT 1 FROM public.crm_team_members tm WHERE lower(tm.email) = lower(v_email)) THEN RETURN true; END IF;
  IF f.estado = 'publicado' THEN RETURN true; END IF;
  IF f.estado = 'beta' AND EXISTS (SELECT 1 FROM public.feature_flag_users u WHERE u.flag_key = p_key AND lower(u.email) = lower(v_email)) THEN RETURN true; END IF;
  RETURN false;
END; $$;

-- Lo que la app consulta al cargar: llaves habilitadas para quien pregunta,
-- con el plan mínimo (la app cruza eso con el plan de la cuenta).
CREATE OR REPLACE FUNCTION public.my_features()
RETURNS TABLE (key text, plan_minimo text, estado text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT f.key, f.plan_minimo, f.estado
  FROM public.feature_flags f
  WHERE public.feature_enabled_for(f.key, auth.uid());
$$;

REVOKE ALL ON FUNCTION public.feature_enabled_for(text, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.feature_enabled_for(text, uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.my_features() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.my_features() TO authenticated, service_role;

-- Primeras llaves: lo que viene en el plan (tablero y bandeja), apagado para
-- los usuarios hasta que Mafe lo publique desde el panel.
INSERT INTO public.feature_flags (key, nombre, descripcion, estado) VALUES
  ('tablero_proyectos', 'Tablero de tareas en Proyectos', 'Vista tablero / lista / calendario de las tareas del Planner dentro de Proyectos.', 'interno'),
  ('bandeja_tareas', 'Bandeja de entrada de tareas', 'Candidatos a tarea que llegan de Notion, correo, Slack y notas; se aceptan o descartan.', 'interno')
ON CONFLICT (key) DO NOTHING;
