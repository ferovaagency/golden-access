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
