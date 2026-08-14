-- Fase 1 — RLS FORCE en todas las tablas.
--
-- Sin FORCE, el DUEÑO de la tabla se salta sus propias políticas. Con FORCE, se
-- las aplica también a él.
--
-- LA AUDITORÍA QUE HABÍA QUE HACER ANTES (14 ago 2026)
-- El miedo razonable era romper algo que corre como dueño y asume el bypass.
-- Se revisó, contra la base viva, quién accede a estas tablas sin ser un usuario
-- autenticado normal:
--
-- 1. Las 3 vistas (business_overview, crm_growth_overview,
--    finance_service_profitability) son `security_invoker=true`: se ejecutan con
--    los permisos de QUIEN consulta, así que ya respetaban la RLS.
-- 2. Ninguna de las 13 funciones SECURITY DEFINER toca las 44 tablas de negocio.
-- 3. La que sí las toca es `roll_forward_missed_planner_tasks()` (cron diario a
--    las 05:10, escribe planner_tasks y audit_log, lee business_profile) — y es
--    SECURITY INVOKER, o sea que corre como el dueño del cron: `postgres`.
--
-- El punto 3 sería el fallo silencioso clásico (el cron deja de reprogramar
-- tareas y nadie se entera), salvo que `postgres` tiene el atributo
-- **BYPASSRLS**, igual que `service_role`. Un rol con BYPASSRLS ignora la RLS
-- aunque la tabla tenga FORCE: es la propia definición del atributo en
-- PostgreSQL. Verificado además empíricamente después de aplicar: como
-- `postgres` se siguen viendo las 76 tareas, los 4 perfiles y las 117 filas de
-- auditoría.
--
-- QUÉ CAMBIA EN LA PRÁCTICA, HOY: nada. Todos los caminos de acceso son o
-- `authenticated` (que ya estaba sujeto a las políticas) o roles con BYPASSRLS
-- (que no lo están ni lo estarán). FORCE es la red para MAÑANA: el día que una
-- migración, un trigger o un rol nuevo acceda a estas tablas sin BYPASSRLS, las
-- políticas se le aplican en lugar de dejarle ver todo.

do $$
declare
  r record;
  n int := 0;
begin
  for r in
    select c.relname
      from pg_class c
      join pg_namespace ns on ns.oid = c.relnamespace
     where ns.nspname = 'public'
       and c.relkind = 'r'
       and c.relrowsecurity           -- sólo donde ya hay RLS activa
       and not c.relforcerowsecurity  -- idempotente
     order by c.relname
  loop
    execute format('alter table public.%I force row level security', r.relname);
    n := n + 1;
  end loop;
  raise notice 'FORCE aplicado a % tablas', n;
end $$;

-- Verificación (debe devolver 74 / 74 / 74 y '(ninguna)'):
--
-- select count(*) as tablas,
--        count(*) filter (where relrowsecurity)      as con_rls,
--        count(*) filter (where relforcerowsecurity) as con_force,
--        coalesce(string_agg(relname, ', ')
--                 filter (where not relrowsecurity or not relforcerowsecurity),
--                 '(ninguna)') as pendientes
--   from pg_class c join pg_namespace n on n.oid = c.relnamespace
--  where n.nspname = 'public' and c.relkind = 'r';
