-- Responsable y autoría en el Planner, y las personas de una cuenta.
--
-- Con varias personas dentro de una misma empresa, una tarea sin responsable no
-- es de nadie, y un registro sin autor no se le puede preguntar a quien lo hizo.
--
-- `created_by` va con DEFAULT auth.uid() en vez de escribirse desde el cliente:
-- así lo llena la base en cada INSERT sin que nadie tenga que acordarse, y al
-- ACTUALIZAR no se toca (PostgREST sólo escribe las columnas que van en la
-- petición). Las edge functions usan service_role, donde auth.uid() es nulo, así
-- que ésas sí lo mandan explícito — el asistente pone el id de la persona que
-- pidió la acción, que es la respuesta útil a "¿quién creó esto?".

alter table public.planner_tasks
  add column if not exists responsable_user_id uuid,
  add column if not exists created_by uuid default auth.uid();

comment on column public.planner_tasks.responsable_user_id is
  'Quién debe hacerla, entre las personas con acceso a esta cuenta. Nulo = sin asignar.';
comment on column public.planner_tasks.created_by is
  'Quién la creó. Lo llena la base en el INSERT; las edge functions lo mandan explícito.';

create index if not exists planner_tasks_responsable_idx
  on public.planner_tasks(user_id, responsable_user_id)
  where responsable_user_id is not null;

-- Las ventas se guardan con upsert (no con borrar-e-insertar), así que aquí el
-- autor sobrevive a las ediciones posteriores.
alter table public.finance_ventas
  add column if not exists created_by uuid default auth.uid();

comment on column public.finance_ventas.created_by is
  'Quién registró la venta. Útil cuando varias personas facturan en la misma empresa.';

-- Personas con acceso a la cuenta en la que se está trabajando ---------------
--
-- Hace falta para poder elegir responsable. `list_organization_members` no
-- sirve: exige mandar en la organización, y un colaborador también necesita
-- saber a quién asignarle algo. Ésta devuelve sólo a los de SU cuenta activa.

create or replace function public.list_account_people()
returns table (user_id uuid, email text, rol text)
language sql
stable
security definer
set search_path = public
as $$
  with cuenta as (select public.current_account_id() as id)
  -- 1. La persona dueña de la cuenta.
  select u.id, u.email::text, 'dueño'::text
    from cuenta c
    join auth.users u on u.id = c.id
  union
  -- 2. Quienes entran por la organización de esa cuenta.
  select u.id, u.email::text, m.rol
    from cuenta c
    join public.organizations o on o.data_user_id = c.id
    join public.organization_members m on m.org_id = o.id
    join auth.users u on u.id = m.user_id
  union
  -- 3. Colaboradores activos del modelo anterior.
  select u.id, u.email::text, 'colaborador'::text
    from cuenta c
    join public.collaborators col on col.owner_user_id = c.id and col.activo
    join auth.users u on u.id = col.user_id;
$$;

revoke all on function public.list_account_people() from public, anon;
grant execute on function public.list_account_people() to authenticated, service_role;

-- Tareas de TODAS las empresas alcanzables, para la vista del holding --------
--
-- Desde el navegador la RLS devuelve una sola cuenta —la activa— a propósito,
-- porque el resto de la aplicación asume que lo que llega es "lo mío". Esta
-- función es la excepción explícita y acotada: sólo tareas abiertas, sólo de
-- cuentas a las que quien pregunta tiene derecho, y con el nombre de la empresa
-- para que nunca se vean mezcladas sin saber de quién son.

create or replace function public.planner_tasks_todas_las_empresas()
-- Los tipos se declaran en `text`/`timestamptz` a propósito: status, priority y
-- category son enums, y devolverlos como enum obliga al cliente a conocerlos.
returns table (
  id uuid,
  account_id uuid,
  empresa text,
  title text,
  status text,
  priority text,
  category text,
  deadline timestamptz,
  scheduled_for timestamptz,
  estimated_minutes integer,
  responsable_user_id uuid,
  responsable_email text
)
language sql
stable
security definer
set search_path = public
as $$
  select t.id,
         t.user_id,
         coalesce(o.nombre, 'Mi negocio')::text,
         t.title,
         t.status::text,
         t.priority::text,
         t.category::text,
         t.deadline,
         t.scheduled_for,
         t.estimated_minutes,
         t.responsable_user_id,
         (select u.email::text from auth.users u where u.id = t.responsable_user_id)
    from public.planner_tasks t
    left join public.organizations o on o.data_user_id = t.user_id
   where t.user_id in (select account_id from public.my_accessible_account_ids())
     and t.status in ('backlog', 'scheduled', 'in_progress', 'postponed')
   order by t.deadline nulls last, t.scheduled_for nulls last;
$$;

revoke all on function public.planner_tasks_todas_las_empresas() from public, anon;
grant execute on function public.planner_tasks_todas_las_empresas() to authenticated, service_role;
