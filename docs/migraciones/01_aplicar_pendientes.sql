-- APLICAR MIGRACIONES PENDIENTES — Ferova One
--
-- Concatenación literal de las migraciones escritas a mano del repo que pueden
-- no estar aplicadas en la base. Generado desde supabase/migrations/, sin
-- reescribir nada.
--
-- ES SEGURO EJECUTARLO ENTERO, esté o no aplicada cada parte: todo es
-- `add column if not exists`, `create ... if not exists` o `create or replace`.
-- Volver a correr una parte ya aplicada no hace nada.
--
-- Nada aquí borra datos ni cambia una política existente.
--
-- Cómo: editor SQL de Supabase -> pegar -> ejecutar. Antes conviene correr
-- 00_diagnostico.sql para ver qué falta.



-- ============================================================
-- 20260812190000_ai_usage_stats.sql
-- ============================================================

-- Fase 4 (costo por usuario) — Ferova One: analítica sobre ai_usage_log.
--
-- El registro de tokens ya existe (20260812180842); esto lo hace LEGIBLE. La
-- decisión de precio necesita el percentil 95 del consumo por usuario, no el
-- promedio (en IA la cola larga es la que descuadra el mes). Aquí va la lógica
-- de agregación; el costo en dinero se deriva fuera con las tarifas vigentes de
-- cada modelo (no se hardcodean tarifas aquí).
--
-- Solo el service_role la ejecuta (una edge function admin la llama). El
-- navegador no toca ai_usage_log ni esta función.

create or replace function public.admin_ai_usage_overview(p_days integer default 30)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with base as (
    select *
    from public.ai_usage_log
    where created_at >= now() - make_interval(days => greatest(p_days, 1))
  ),
  por_usuario as (
    select
      user_id,
      count(*)                              as llamadas,
      coalesce(sum(input_tokens), 0)        as input_tokens,
      coalesce(sum(output_tokens), 0)       as output_tokens,
      coalesce(sum(cached_input_tokens), 0) as cached_tokens,
      coalesce(sum(total_tokens), 0)        as total_tokens
    from base
    group by user_id
  )
  select jsonb_build_object(
    'ventana_dias', greatest(p_days, 1),
    'generado_en', now(),
    'totales', jsonb_build_object(
      'llamadas',       (select count(*) from base),
      'usuarios_activos', (select count(*) from por_usuario),
      'input_tokens',   (select coalesce(sum(input_tokens), 0) from base),
      'output_tokens',  (select coalesce(sum(output_tokens), 0) from base),
      'cached_tokens',  (select coalesce(sum(cached_input_tokens), 0) from base),
      'total_tokens',   (select coalesce(sum(total_tokens), 0) from base)
    ),
    -- p95 de tokens por llamada individual (la conversación cara puntual).
    'p95_tokens_por_llamada',
      (select percentile_cont(0.95) within group (order by total_tokens)
       from base where total_tokens is not null),
    -- p95 de tokens acumulados por usuario en la ventana (el usuario caro).
    'p95_tokens_por_usuario',
      (select percentile_cont(0.95) within group (order by total_tokens)
       from por_usuario),
    'mediana_tokens_por_usuario',
      (select percentile_cont(0.50) within group (order by total_tokens)
       from por_usuario),
    -- Top 10 usuarios por consumo: donde vive el riesgo de costo.
    'top_usuarios', coalesce((
      select jsonb_agg(u)
      from (
        select user_id, llamadas, input_tokens, output_tokens, cached_tokens, total_tokens
        from por_usuario
        order by total_tokens desc
        limit 10
      ) u
    ), '[]'::jsonb),
    -- Desglose por función: qué endpoint consume más.
    'por_funcion', coalesce((
      select jsonb_agg(f)
      from (
        select
          funcion,
          count(*)                       as llamadas,
          coalesce(sum(total_tokens), 0) as total_tokens,
          coalesce(sum(cached_input_tokens), 0) as cached_tokens
        from base
        group by funcion
        order by total_tokens desc
      ) f
    ), '[]'::jsonb),
    -- Desglose por modelo: para validar el enrutado barato/caro.
    'por_modelo', coalesce((
      select jsonb_agg(m)
      from (
        select
          modelo,
          count(*)                       as llamadas,
          coalesce(sum(input_tokens), 0) as input_tokens,
          coalesce(sum(output_tokens), 0) as output_tokens,
          coalesce(sum(total_tokens), 0) as total_tokens
        from base
        group by modelo
        order by total_tokens desc
      ) m
    ), '[]'::jsonb)
  );
$$;

-- Nadie desde el navegador ejecuta esto; solo el service_role (edge admin).
revoke all on function public.admin_ai_usage_overview(integer) from anon, authenticated;


-- ============================================================
-- 20260812191000_crm_resenas_taint.sql
-- ============================================================

-- Fase 6 (confianza) — Ferova One: marca de origen no confiable en reseñas.
--
-- reviews-scan lee CORREOS (contenido no confiable) y los pasa a la IA para
-- extraer la reseña, que hoy se inserta directo en crm_resenas. Eso mezcla
-- contenido externo potencialmente manipulado (prompt-injection) con los datos
-- del negocio sin ningún filtro humano. Añadimos:
--   - origen: de dónde vino la fila ('manual' | 'ia_email').
--   - confirmada: si un humano ya la validó. Las derivadas de correo entran en
--     false y NO deben propagarse a métricas ni al contexto del asistente hasta
--     que alguien las confirme.
-- Las filas existentes quedan como confirmadas para no ocultar histórico.

alter table public.crm_resenas
  add column if not exists origen text not null default 'manual';

alter table public.crm_resenas
  add column if not exists confirmada boolean not null default true;


-- ============================================================
-- 20260812192000_account_deletion_request.sql
-- ============================================================

-- Fase 6 (confianza) — Ferova One: solicitud de eliminación de cuenta con gracia.
--
-- El borrado inmediato es irreversible y no se puede deshacer si fue un error.
-- En su lugar, el usuario SOLICITA la eliminación y queda un período de gracia
-- durante el cual puede cancelarla. Un trabajo programado (cron) hace la purga
-- real cuando deletion_scheduled_for ya pasó (ver docs/PLAN_LANZAMIENTO_ESTADO.md),
-- borrando también los datos derivados (embeddings del cerebro).
--
-- Aquí solo se agregan las marcas de intención; nada se destruye.

alter table public.business_profile
  add column if not exists deletion_requested_at timestamptz;

alter table public.business_profile
  add column if not exists deletion_scheduled_for timestamptz;


-- ============================================================
-- 20260812220000_user_subscriptions_provider_order_full_unique.sql
-- ============================================================

-- Fix del webhook de Paddle: el upsert usa ON CONFLICT (provider, provider_order_id),
-- pero el único índice que lo respaldaba era PARCIAL (WHERE provider_order_id IS NOT NULL).
-- PostgreSQL no infiere un índice parcial como árbitro de ON CONFLICT sin repetir el
-- predicado (y supabase-js no lo envía) → error 42P10 → la activación fallaba con 500.
--
-- Lo convertimos en índice único TOTAL. Sigue siendo seguro: en un índice único los
-- NULL se consideran distintos, así que múltiples filas con provider_order_id NULL
-- siguen permitidas; y entre los no-nulos ya no había duplicados. El webhook siempre
-- inserta provider_order_id no-nulo, así que ahora el ON CONFLICT resuelve bien.

drop index if exists public.user_subscriptions_provider_order_unique;

create unique index if not exists user_subscriptions_provider_order_unique
  on public.user_subscriptions (provider, provider_order_id);


-- ============================================================
-- 20260813010000_admin_subscriptions_overview.sql
-- ============================================================

-- Fase 7 (precio) — Ferova One: resumen de suscripciones/MRR para el admin.
-- Métrica reina de un SaaS autofinanciado. Solo agregados; el service_role la
-- llama desde una edge function admin. No expone datos de clientes individuales.

create or replace function public.admin_subscriptions_overview()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'generado_en', now(),
    'activos', (select count(*) from public.user_subscriptions where status = 'active'),
    'activos_pagos', (select count(*) from public.user_subscriptions
                      where status = 'active' and provider not in ('manual','courtesy')),
    'nuevos_mes', (select count(*) from public.user_subscriptions
                   where status = 'active' and provider not in ('manual','courtesy')
                     and created_at >= date_trunc('month', now())),
    'por_estado', coalesce((
      select jsonb_agg(e) from (
        select status, count(*) as n
        from public.user_subscriptions group by status order by n desc
      ) e), '[]'::jsonb),
    'por_proveedor', coalesce((
      select jsonb_agg(p) from (
        select provider, count(*) as n
        from public.user_subscriptions where status = 'active'
        group by provider order by n desc
      ) p), '[]'::jsonb)
  );
$$;

revoke all on function public.admin_subscriptions_overview() from anon, authenticated;


-- ============================================================
-- 20260813120000_planner_blocks_recurrence.sql
-- ============================================================

-- Planner: recurrencia en bloques protegidos. Antes solo los tasks tenían
-- recurrencia; ahora un bloque protegido (ej. "deep work Lun/Mié 9-11") puede
-- repetirse por días de la semana. Mismo formato que planner_tasks:
--   recurrence_days = int[] con 0=domingo .. 6=sábado
--   recurrence_until = fecha final (o null = horizonte por defecto)
-- Aditivo y seguro.

alter table public.planner_blocks
  add column if not exists recurrence_days integer[] not null default '{}';

alter table public.planner_blocks
  add column if not exists recurrence_until date;


-- ============================================================
-- 20260813140000_biz_crm_contactos_campos.sql
-- ============================================================

-- CRM propio del cliente (biz_crm_contactos): campos de un CRM de verdad.
-- Antes solo había nombre/empresa/tel/email/estado/valor/notas/próxima acción.
-- Se agregan fuente, sitio web, LinkedIn, cargo y probabilidad de cierre.
-- Aditivo y seguro.

alter table public.biz_crm_contactos
  add column if not exists canal_origen text,
  add column if not exists sitio_web text,
  add column if not exists linkedin text,
  add column if not exists cargo text,
  add column if not exists probabilidad integer;


-- ============================================================
-- 20260814120000_organizations_base.sql
-- ============================================================

-- Modelo de organizaciones: holding (padre) + empresas (hijas).
--
-- MIGRACIÓN ADITIVA. No toca ninguna tabla de datos, no modifica ninguna
-- política existente y no altera ninguna clave primaria. Las tres tablas nacen
-- vacías, así que aplicarla NO cambia el comportamiento de nadie: el acceso
-- del holding se enciende insertando filas en organization_members, a
-- conciencia y de a una.
--
-- Ver docs/DISENO_ORGANIZACIONES.md.

-- 1) Tablas ------------------------------------------------------------------

create table if not exists public.organizations (
  id            uuid primary key default gen_random_uuid(),
  nombre        text not null,
  parent_org_id uuid references public.organizations(id) on delete restrict,
  -- Cuenta cuyos datos constituyen esta organización. NULL = organización
  -- contenedora (el holding, que no tiene datos propios) o empresa cuyo
  -- fundador todavía no se ha registrado.
  data_user_id  uuid,
  -- Invitación: cuando este correo se registre, su cuenta queda enlazada aquí.
  invite_email  text,
  -- Valor por defecto de "compartir con el holding" para el conocimiento que
  -- se escriba en esta organización. Lo consume la Fase 5 (cerebro).
  comparte_por_defecto boolean not null default false,
  created_by    uuid,
  created_at    timestamptz not null default now(),
  constraint organizations_no_self_parent check (parent_org_id is null or parent_org_id <> id)
);

create unique index if not exists organizations_data_user_key
  on public.organizations(data_user_id) where data_user_id is not null;
create unique index if not exists organizations_invite_email_key
  on public.organizations(lower(invite_email)) where invite_email is not null and data_user_id is null;
create index if not exists organizations_parent_idx
  on public.organizations(parent_org_id);

create table if not exists public.organization_members (
  org_id     uuid not null references public.organizations(id) on delete cascade,
  user_id    uuid not null,
  -- owner/admin mandan y su acceso baja a las organizaciones descendientes;
  -- colaborador se queda en la suya.
  rol        text not null default 'colaborador' check (rol in ('owner','admin','colaborador')),
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);
create index if not exists organization_members_user_idx on public.organization_members(user_id);

create table if not exists public.user_active_org (
  user_id    uuid primary key,
  org_id     uuid not null references public.organizations(id) on delete cascade,
  updated_at timestamptz not null default now()
);

-- 2) Funciones de jerarquía y acceso -----------------------------------------

-- Descendientes de una organización, ella incluida. El tope de profundidad es
-- una red de seguridad: un ciclo en parent_org_id colgaría el CTE recursivo.
create or replace function public.org_descendants(root uuid)
returns table (id uuid)
language sql stable security definer set search_path = public as $$
  with recursive tree as (
    select o.id, 1 as depth
      from public.organizations o
     where o.id = root
    union all
    select o.id, t.depth + 1
      from public.organizations o
      join tree t on o.parent_org_id = t.id
     where t.depth < 10
  )
  select tree.id from tree;
$$;

-- Organizaciones que el usuario actual puede ver. owner/admin heredan hacia
-- abajo (el holding ve sus empresas); colaborador sólo ve la suya.
-- SECURITY DEFINER a propósito: la usan las políticas de organization_members,
-- y si fuese INVOKER la política se llamaría a sí misma.
create or replace function public.my_accessible_org_ids()
returns table (id uuid)
language sql stable security definer set search_path = public as $$
  select distinct d.id
    from public.organization_members m
    cross join lateral public.org_descendants(m.org_id) d
   where m.user_id = auth.uid()
     and (m.rol in ('owner','admin') or d.id = m.org_id);
$$;

-- ¿Manda el usuario actual en esta organización (directamente o desde un
-- ancestro)?
create or replace function public.can_admin_org(target uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
      from public.organization_members m
      cross join lateral public.org_descendants(m.org_id) d
     where m.user_id = auth.uid()
       and m.rol in ('owner','admin')
       and d.id = target
  );
$$;

-- ¿Puede el usuario actual operar sobre los datos de la cuenta `owner`?
-- Las dos primeras ramas son el comportamiento de hoy. La tercera es la nueva
-- y no concede nada mientras organization_members esté vacía.
--
-- Todavía NO la usa ninguna política: se deja lista para la Fase 7, cuando se
-- reescriba la RLS de las tablas de negocio.
create or replace function public.can_access_account(owner uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select
    auth.uid() = owner
    or public.is_collaborator_of(owner)
    or exists (
      select 1
        from public.organizations hija
       where hija.data_user_id = owner
         and public.can_admin_org(hija.id)
    );
$$;

-- 3) RLS de las tablas nuevas ------------------------------------------------

alter table public.organizations       enable row level security;
alter table public.organization_members enable row level security;
alter table public.user_active_org      enable row level security;

drop policy if exists "orgs read accessible" on public.organizations;
create policy "orgs read accessible" on public.organizations
  for select to authenticated
  using (id in (select id from public.my_accessible_org_ids()));

drop policy if exists "orgs write admin" on public.organizations;
create policy "orgs write admin" on public.organizations
  for all to authenticated
  using (public.can_admin_org(id))
  with check (public.can_admin_org(id));

drop policy if exists "org members read" on public.organization_members;
create policy "org members read" on public.organization_members
  for select to authenticated
  using (user_id = auth.uid() or org_id in (select id from public.my_accessible_org_ids()));

drop policy if exists "org members write admin" on public.organization_members;
create policy "org members write admin" on public.organization_members
  for all to authenticated
  using (public.can_admin_org(org_id))
  with check (public.can_admin_org(org_id));

drop policy if exists "active org own" on public.user_active_org;
create policy "active org own" on public.user_active_org
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and org_id in (select id from public.my_accessible_org_ids()));

-- 4) Alta de organizaciones --------------------------------------------------

-- Crear una organización e inscribirse como owner es atómico: por eso va en una
-- función y no en una política de INSERT (que dejaría organizaciones huérfanas
-- si la segunda escritura fallara).
create or replace function public.create_organization(
  p_nombre               text,
  p_parent_org_id        uuid    default null,
  p_invite_email         text    default null,
  p_vincular_mi_cuenta   boolean default false,
  p_comparte_por_defecto boolean default false
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;
  if coalesce(trim(p_nombre), '') = '' then
    raise exception 'La organización necesita un nombre';
  end if;
  if p_parent_org_id is not null and not public.can_admin_org(p_parent_org_id) then
    raise exception 'Sin permiso sobre la organización padre';
  end if;
  if p_vincular_mi_cuenta and p_invite_email is not null then
    raise exception 'Una organización se vincula a tu cuenta o invita a otra, no ambas';
  end if;

  insert into public.organizations (nombre, parent_org_id, data_user_id, invite_email, comparte_por_defecto, created_by)
  values (
    trim(p_nombre),
    p_parent_org_id,
    case when p_vincular_mi_cuenta then auth.uid() else null end,
    nullif(lower(trim(p_invite_email)), ''),
    p_comparte_por_defecto,
    auth.uid()
  )
  returning id into v_id;

  insert into public.organization_members (org_id, user_id, rol)
  values (v_id, auth.uid(), 'owner')
  on conflict do nothing;

  return v_id;
end; $$;

-- 5) Enlazar la invitación cuando el fundador se registre --------------------
-- Se extiende el trigger existente conservando su comportamiento previo.

create or replace function public.handle_new_user_team()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.crm_team_members limit 1) then
    insert into public.crm_team_members (email, nombre, rol, user_id)
    values (new.email, coalesce(new.raw_user_meta_data->>'full_name', new.email), 'owner', new.id);
  else
    update public.crm_team_members
       set user_id = new.id
     where user_id is null and lower(email) = lower(new.email);
  end if;

  update public.collaborators
     set user_id = new.id
   where user_id is null and lower(email) = lower(new.email);

  -- Organización invitada por correo: queda enlazada a la cuenta recién creada
  -- y su fundador entra como owner de la suya (no del holding).
  update public.organizations
     set data_user_id = new.id
   where data_user_id is null
     and invite_email is not null
     and lower(invite_email) = lower(new.email);

  insert into public.organization_members (org_id, user_id, rol)
  select o.id, new.id, 'owner'
    from public.organizations o
   where o.data_user_id = new.id
  on conflict do nothing;

  return new;
end; $$;

-- 6) Permisos ----------------------------------------------------------------

revoke all on function public.org_descendants(uuid)        from public, anon;
revoke all on function public.my_accessible_org_ids()      from public, anon;
revoke all on function public.can_admin_org(uuid)          from public, anon;
revoke all on function public.can_access_account(uuid)     from public, anon;
revoke all on function public.create_organization(text, uuid, text, boolean, boolean) from public, anon;

grant execute on function public.org_descendants(uuid)     to authenticated, service_role;
grant execute on function public.my_accessible_org_ids()   to authenticated, service_role;
grant execute on function public.can_admin_org(uuid)       to authenticated, service_role;
grant execute on function public.can_access_account(uuid)  to authenticated, service_role;
grant execute on function public.create_organization(text, uuid, text, boolean, boolean) to authenticated, service_role;

revoke all on function public.handle_new_user_team() from public, anon, authenticated;
