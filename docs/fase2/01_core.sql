-- Fase 2 · 01 · Núcleo de organizaciones. Correr en STAGING primero.

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.organization_members (
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null,
  rol text not null default 'colaborador' check (rol in ('owner','admin','colaborador')),
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);
-- Un usuario puede pertenecer a varias organizaciones (multi-org).
create index if not exists organization_members_user_idx on public.organization_members(user_id);

-- Organización activa desde la que consulta cada usuario.
create table if not exists public.user_active_org (
  user_id uuid primary key,
  org_id uuid not null references public.organizations(id)
);

-- La org activa del que consulta. STABLE + SECURITY DEFINER + search_path vacío.
create or replace function public.current_org_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select org_id from public.user_active_org where user_id = auth.uid()
$$;

-- ¿pertenece el usuario actual a esta org?
create or replace function public.is_org_member(target_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.organization_members
    where org_id = target_org and user_id = auth.uid()
  )
$$;

alter table public.organizations       enable row level security;
alter table public.organization_members enable row level security;
alter table public.user_active_org      enable row level security;

-- Cada quien ve las orgs a las que pertenece y su propia membresía / org activa.
create policy org_select_member on public.organizations
  for select using (public.is_org_member(id));
create policy org_members_select_self on public.organization_members
  for select using (user_id = auth.uid() or public.is_org_member(org_id));
create policy user_active_org_rw on public.user_active_org
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Nadie desde el navegador ejecuta helpers de org por fuera de las políticas.
revoke all on function public.current_org_id() from anon, authenticated;
revoke all on function public.is_org_member(uuid) from anon, authenticated;
