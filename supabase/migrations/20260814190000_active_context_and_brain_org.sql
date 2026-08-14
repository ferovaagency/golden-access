-- Fase 2 (servidor) — la empresa activa manda, y el cerebro sabe de qué empresa
-- es cada nota.
--
-- PROBLEMA QUE RESUELVE
-- El selector de empresa ya cambia `accountId` en el navegador, pero las edge
-- functions resolvían la cuenta con el `user.id` del token: si el holding
-- entraba a una empresa hija, el asistente seguía respondiendo sobre la cuenta
-- del holding. Y no se puede leer la cuenta del body de la petición — sería
-- pedirle al cliente que declare a qué datos accede.
--
-- La cuenta activa se resuelve por tanto EN LA BASE, a partir de
-- `user_active_org`, y con la autorización comprobada aquí: las edge functions
-- usan service_role, que salta la RLS, así que este archivo es el control de
-- acceso, no una comodidad.

-- 1) Contexto activo del usuario ---------------------------------------------

create or replace function public.active_context_for_user(p_user uuid)
returns table (account_id uuid, org_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  with elegida as (
    select o.id, o.data_user_id
      from public.user_active_org a
      join public.organizations o on o.id = a.org_id
     where a.user_id = p_user
       and o.data_user_id is not null
       -- Autorización explícita: o es su propia cuenta, o manda en la
       -- organización (directamente o desde un ancestro del árbol).
       and (
         o.data_user_id = p_user
         or exists (
           select 1
             from public.organization_members m
             cross join lateral public.org_descendants(m.org_id) d
            where m.user_id = p_user
              and m.rol in ('owner', 'admin')
              and d.id = o.id
         )
       )
     limit 1
  )
  -- Siempre devuelve exactamente una fila: sin empresa activa (o sin permiso
  -- sobre ella) el contexto es la cuenta propia y org_id nulo.
  select coalesce((select data_user_id from elegida), p_user) as account_id,
         (select id from elegida)                             as org_id;
$$;

-- Recibe un usuario por parámetro, así que sólo el servidor puede llamarla:
-- desde el navegador equivaldría a preguntar por el contexto de otra persona.
revoke all on function public.active_context_for_user(uuid) from public, anon, authenticated;
grant execute on function public.active_context_for_user(uuid) to service_role;

-- 2) El cerebro, por organización --------------------------------------------
--
-- Dos ejes, según el diseño: lo que una empresa comparte HACIA ARRIBA (para que
-- el holding lo tenga en cuenta) y lo que el holding publica HACIA ABAJO (para
-- que lo tengan todas sus empresas). Por defecto ninguno de los dos: una nota
-- se queda donde se escribió.

alter table public.ferova_knowledge
  add column if not exists org_id           uuid references public.organizations(id) on delete set null,
  add column if not exists compartir_arriba boolean not null default false,
  add column if not exists publicar_abajo   boolean not null default false;

create index if not exists ferova_knowledge_org_idx on public.ferova_knowledge(org_id);

-- 3) Búsqueda vectorial consciente de la organización ------------------------
--
-- `match_org` es un parámetro NUEVO CON DEFAULT NULL: con null la función se
-- comporta exactamente como antes (una sola cuenta, sin organizaciones), así
-- que las llamadas existentes no cambian de significado.
--
-- Esta función es SECURITY DEFINER y sólo la ejecuta service_role: el filtro de
-- aquí ES el control de acceso, no hay RLS detrás que salve un error. Es la
-- línea más delicada del diseño.
--
-- Se BORRA la versión de 4 argumentos antes de crear la de 5: convivir las dos
-- haría ambigua toda llamada con 4 argumentos ("function is not unique").

drop function if exists public.match_ferova_knowledge(text, uuid, integer, double precision);

create or replace function public.match_ferova_knowledge(
  query_embedding text,
  match_user      uuid    default null,
  match_count     integer default 6,
  min_similarity  double precision default 0.0,
  match_org       uuid    default null
)
returns table (
  knowledge_id uuid,
  title text,
  content text,
  owner_user_id uuid,
  source text,
  similarity double precision
)
language sql
stable
security definer
set search_path = public
as $$
  select best.knowledge_id, best.title, best.content, best.owner_user_id, best.source, best.similarity
  from (
    select distinct on (k.id)
           k.id as knowledge_id, k.title, k.content, k.owner_user_id, k.source,
           1 - (e.embedding <=> query_embedding::vector(768)) as similarity
    from public.ferova_knowledge_embeddings e
    join public.ferova_knowledge k on k.id = e.knowledge_id
    where
      case
        -- Sin organización activa: comportamiento anterior, intacto.
        when match_org is null then
          (k.owner_user_id is null or k.owner_user_id = match_user)
        else
          -- 1. Lo de mi propia organización.
          k.org_id = match_org
          -- 2. Lo que una empresa mía compartió hacia arriba.
          or (k.compartir_arriba
              and k.org_id in (select d.id from public.org_descendants(match_org) d))
          -- 3. Lo que un ancestro publicó hacia abajo.
          or (k.publicar_abajo
              and match_org in (select d.id from public.org_descendants(k.org_id) d))
          -- 4. Notas anteriores a las organizaciones: se rigen por la regla vieja.
          or (k.org_id is null and (k.owner_user_id is null or k.owner_user_id = match_user))
      end
    order by k.id, e.embedding <=> query_embedding::vector(768)
  ) best
  where best.similarity >= min_similarity
  order by best.similarity desc
  limit match_count;
$$;

revoke all on function public.match_ferova_knowledge(text, uuid, integer, double precision, uuid) from public, anon, authenticated;
grant execute on function public.match_ferova_knowledge(text, uuid, integer, double precision, uuid) to service_role;
