-- ============================================================
-- FEROVA BRAIN — memoria semántica (segundo cerebro) del asistente
-- Reusa el modelo de equipo del proyecto: is_team_member() + auth.uid().
-- owner_user_id NULL = memoria GLOBAL (todo el equipo) | con valor = PRIVADA.
-- Embeddings: google/gemini-embedding-001 (768 dims) vía Lovable AI Gateway.
-- ============================================================
create extension if not exists vector;

-- ---------- Conocimiento ----------
create table if not exists public.ferova_knowledge (
  id            uuid primary key default gen_random_uuid(),
  owner_user_id uuid references auth.users(id) on delete cascade,   -- null = global/equipo
  title         text not null,
  content       text not null,
  source        text,
  tags          text[] not null default '{}',
  created_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists ix_ferova_knowledge_owner on public.ferova_knowledge(owner_user_id);
create index if not exists ix_ferova_knowledge_tags  on public.ferova_knowledge using gin(tags);

drop trigger if exists trg_ferova_knowledge_updated on public.ferova_knowledge;
create trigger trg_ferova_knowledge_updated before update on public.ferova_knowledge
  for each row execute function public.update_updated_at_column();

-- ---------- Embeddings (memoria semántica) ----------
create table if not exists public.ferova_knowledge_embeddings (
  id            uuid primary key default gen_random_uuid(),
  knowledge_id  uuid not null references public.ferova_knowledge(id) on delete cascade,
  content_chunk text not null,
  embedding     vector(768),
  created_at    timestamptz not null default now()
);
create index if not exists ix_ferova_knowledge_emb_kid on public.ferova_knowledge_embeddings(knowledge_id);
create index if not exists ix_ferova_knowledge_emb_vec on public.ferova_knowledge_embeddings
  using hnsw (embedding vector_cosine_ops);

-- ---------- RLS ----------
alter table public.ferova_knowledge            enable row level security;
alter table public.ferova_knowledge_embeddings enable row level security;

-- knowledge: solo miembros del equipo; cada quien ve lo GLOBAL + lo PRIVADO propio
drop policy if exists "team ferova_knowledge read"  on public.ferova_knowledge;
create policy "team ferova_knowledge read" on public.ferova_knowledge for select to authenticated
  using (public.is_team_member() and (owner_user_id is null or owner_user_id = auth.uid()));

drop policy if exists "team ferova_knowledge write" on public.ferova_knowledge;
create policy "team ferova_knowledge write" on public.ferova_knowledge for all to authenticated
  using      (public.is_team_member() and (owner_user_id is null or owner_user_id = auth.uid()))
  with check (public.is_team_member() and (owner_user_id is null or owner_user_id = auth.uid()));

-- embeddings: sin acceso directo de clientes (solo service_role / funciones).
-- RLS activo y SIN policies para authenticated => acceso denegado salvo service_role.

grant select, insert, update, delete on public.ferova_knowledge to authenticated;
grant all on public.ferova_knowledge            to service_role;
grant all on public.ferova_knowledge_embeddings to service_role;

-- ---------- Búsqueda semántica ----------
-- Solo la ejecuta el service_role (las edge functions, tras verificar el login del
-- usuario y pasar su id en match_user). Filtra a global + privado de ese usuario.
create or replace function public.match_ferova_knowledge(
  query_embedding text,
  match_user uuid default null,
  match_count int default 6,
  min_similarity float default 0.0
)
returns table (knowledge_id uuid, title text, content text, owner_user_id uuid, source text, similarity float)
language sql stable security definer set search_path = public as $$
  select k.id, k.title, k.content, k.owner_user_id, k.source,
         1 - (e.embedding <=> query_embedding::vector(768)) as similarity
  from public.ferova_knowledge_embeddings e
  join public.ferova_knowledge k on k.id = e.knowledge_id
  where (k.owner_user_id is null or k.owner_user_id = match_user)
    and 1 - (e.embedding <=> query_embedding::vector(768)) >= min_similarity
  order by e.embedding <=> query_embedding::vector(768)
  limit match_count;
$$;

revoke all on function public.match_ferova_knowledge(text, uuid, int, float) from public, authenticated;
grant execute on function public.match_ferova_knowledge(text, uuid, int, float) to service_role;
