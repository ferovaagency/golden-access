-- Fase 4 (costo por usuario) — Ferova One: bitácora de uso de tokens de IA.
--
-- Cada llamada al modelo registra aquí sus tokens (entrada, salida, cacheados)
-- para poder medir el costo real por conversación y por usuario ANTES de fijar
-- precio. Guardamos tokens crudos + el modelo; el costo en dinero se calcula
-- después con las tarifas vigentes de cada modelo (no se hardcodea aquí).
--
-- Solo las edge functions (service_role) escriben/leen; el navegador nunca. La
-- analítica la sirve una edge function admin con service_role, no consultas del
-- cliente. Mismo patrón de aislamiento que google_workspace_connections.

create table if not exists public.ai_usage_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  funcion text not null,
  modelo text not null,
  input_tokens integer,
  output_tokens integer,
  cached_input_tokens integer,
  total_tokens integer,
  created_at timestamptz not null default now()
);

alter table public.ai_usage_log enable row level security;

-- El navegador no tiene ningún acceso: solo el service_role (que salta RLS por
-- diseño) escribe y lee esta tabla.
revoke all on public.ai_usage_log from anon, authenticated;

create index if not exists ai_usage_log_user_created_idx on public.ai_usage_log (user_id, created_at desc);
create index if not exists ai_usage_log_created_idx on public.ai_usage_log (created_at desc);
create index if not exists ai_usage_log_funcion_idx on public.ai_usage_log (funcion, created_at desc);
