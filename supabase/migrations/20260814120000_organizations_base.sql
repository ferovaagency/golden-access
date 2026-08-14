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
