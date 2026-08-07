-- Servicio: el IVA se decide por línea de servicio y no cambia el histórico
-- de ventas ya creadas. Las ventas nuevas pueden mostrarlo al cobrar.
alter table public.finance_servicios
  add column if not exists aplica_iva boolean not null default false;

-- Planner: permite medir trabajo real y enlazar una tarea con el servicio al
-- que se imputará el tiempo cuando el usuario la cierre.
alter table public.planner_tasks
  add column if not exists started_at timestamptz,
  add column if not exists service_ref text;

create index if not exists planner_tasks_user_started_at_idx
  on public.planner_tasks (user_id, started_at desc)
  where started_at is not null;
