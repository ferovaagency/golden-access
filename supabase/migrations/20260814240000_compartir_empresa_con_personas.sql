-- Compartir una empresa con otras personas.
--
-- El permiso ya existía (`organization_members`), pero no había forma de dar de
-- alta a nadie: sólo entraba quien creaba la organización. Instalar a un cliente
-- del holding se quedaba a medias — sus socios no podían entrar.
--
-- Además se corrige un hueco del modelo: `my_accessible_account_ids()` sólo
-- concedía acceso a `owner`/`admin`, así que el rol `colaborador` no servía para
-- nada. Ahora:
--   · owner/admin  → su organización Y todas las que cuelgan de ella (el
--                    holding entra a cualquiera de sus empresas);
--   · colaborador  → sólo la suya, sin heredar hacia abajo.
-- Es exactamente la regla que ya usaba `my_accessible_org_ids()` para decidir
-- qué organizaciones se ven; las dos funciones dejan de contradecirse.

-- 1) Acceso por rol -----------------------------------------------------------

create or replace function public.my_accessible_account_ids()
returns table (account_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() where auth.uid() is not null
  union
  select c.owner_user_id
    from public.collaborators c
   where c.user_id = auth.uid()
     and c.activo
  union
  select o.data_user_id
    from public.organization_members m
    cross join lateral public.org_descendants(m.org_id) d
    join public.organizations o on o.id = d.id
   where m.user_id = auth.uid()
     and (m.rol in ('owner', 'admin') or d.id = m.org_id)
     and o.data_user_id is not null;
$$;

-- 2) Invitaciones a personas que aún no tienen cuenta -------------------------

create table if not exists public.organization_invites (
  org_id     uuid not null references public.organizations(id) on delete cascade,
  email      text not null,
  rol        text not null default 'colaborador' check (rol in ('admin', 'colaborador')),
  created_by uuid,
  created_at timestamptz not null default now(),
  primary key (org_id, email)
);

alter table public.organization_invites enable row level security;
alter table public.organization_invites force row level security;

-- Sólo quien manda en la organización ve y quita sus invitaciones. El alta se
-- hace por función (abajo), no con un INSERT directo.
drop policy if exists "invites read admin" on public.organization_invites;
create policy "invites read admin" on public.organization_invites
  for select to authenticated
  using (public.can_admin_org(org_id));

drop policy if exists "invites delete admin" on public.organization_invites;
create policy "invites delete admin" on public.organization_invites
  for delete to authenticated
  using (public.can_admin_org(org_id));

-- 3) Compartir --------------------------------------------------------------
--
-- Una sola función para los dos casos: si la persona ya tiene cuenta entra de
-- inmediato; si no, queda invitada y entra sola al registrarse. Quien llama
-- tiene que mandar en la organización — la comprobación está aquí porque la
-- función es SECURITY DEFINER (necesita leer auth.users para resolver el
-- correo, algo que el navegador no puede hacer).

create or replace function public.share_organization(
  p_org_id uuid,
  p_email  text,
  p_rol    text default 'colaborador'
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(p_email));
  v_user  uuid;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  if not public.can_admin_org(p_org_id) then
    raise exception 'Sin permiso sobre esta organización';
  end if;
  if v_email is null or v_email = '' then raise exception 'Escribe un correo'; end if;
  if p_rol not in ('admin', 'colaborador') then
    -- `owner` no se reparte: es de quien creó la organización o de la cuenta
    -- dueña de los datos.
    raise exception 'El rol debe ser admin o colaborador';
  end if;

  select u.id into v_user from auth.users u where lower(u.email) = v_email limit 1;

  if v_user is not null then
    insert into public.organization_members (org_id, user_id, rol)
    values (p_org_id, v_user, p_rol)
    on conflict (org_id, user_id) do update set rol = excluded.rol;
    delete from public.organization_invites where org_id = p_org_id and email = v_email;
    return 'agregado';
  end if;

  insert into public.organization_invites (org_id, email, rol, created_by)
  values (p_org_id, v_email, p_rol, auth.uid())
  on conflict (org_id, email) do update set rol = excluded.rol;
  return 'invitado';
end; $$;

revoke all on function public.share_organization(uuid, text, text) from public, anon;
grant execute on function public.share_organization(uuid, text, text) to authenticated, service_role;

-- 4) Quitar el acceso ---------------------------------------------------------

create or replace function public.revoke_organization_member(p_org_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.can_admin_org(p_org_id) then
    raise exception 'Sin permiso sobre esta organización';
  end if;
  if exists (select 1 from public.organization_members m
              where m.org_id = p_org_id and m.user_id = p_user_id and m.rol = 'owner') then
    raise exception 'No se puede quitar al dueño de la organización';
  end if;
  delete from public.organization_members where org_id = p_org_id and user_id = p_user_id;
  -- Si estaba trabajando en esa empresa, se le devuelve a la suya.
  delete from public.user_active_org a
   using public.organizations o
   where a.user_id = p_user_id and a.org_id = o.id and o.id = p_org_id;
end; $$;

revoke all on function public.revoke_organization_member(uuid, uuid) from public, anon;
grant execute on function public.revoke_organization_member(uuid, uuid) to authenticated, service_role;

-- 5) Quién tiene acceso hoy ---------------------------------------------------
--
-- El navegador no puede leer auth.users, así que la lista de personas con su
-- correo tiene que salir de una función. Sólo la ve quien manda en la
-- organización.

create or replace function public.list_organization_members(p_org_id uuid)
returns table (user_id uuid, email text, rol text, estado text)
language sql
stable
security definer
set search_path = public
as $$
  select m.user_id, u.email::text, m.rol, 'activo'::text
    from public.organization_members m
    join auth.users u on u.id = m.user_id
   where m.org_id = p_org_id
     and public.can_admin_org(p_org_id)
  union all
  select null::uuid, i.email, i.rol, 'invitado'::text
    from public.organization_invites i
   where i.org_id = p_org_id
     and public.can_admin_org(p_org_id)
   order by 4, 2;
$$;

revoke all on function public.list_organization_members(uuid) from public, anon;
grant execute on function public.list_organization_members(uuid) to authenticated, service_role;

-- 6) La invitación se cobra al registrarse ------------------------------------

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

  -- Invitaciones a organizaciones ajenas (compartir una empresa con alguien).
  insert into public.organization_members (org_id, user_id, rol)
  select i.org_id, new.id, i.rol
    from public.organization_invites i
   where lower(i.email) = lower(new.email)
  on conflict (org_id, user_id) do nothing;

  delete from public.organization_invites where lower(email) = lower(new.email);

  return new;
end; $$;

revoke all on function public.handle_new_user_team() from public, anon, authenticated;
