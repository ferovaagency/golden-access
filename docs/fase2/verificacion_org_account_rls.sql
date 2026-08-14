-- VERIFICACIÓN de 20260814180000_org_account_rls.sql — sólo lee, no cambia nada.
--
-- Se corre DESPUÉS de aplicar la migración. Son tres bloques independientes:
-- pégalos de a uno y mira el resultado.
--
-- Nota sobre pgTAP: la extensión está disponible en el proyecto pero NO
-- instalada, y sus pruebas clásicas insertan filas de semilla. Este archivo hace
-- el mismo trabajo sin instalar nada y sin escribir una sola fila: se hace pasar
-- por cada usuario real (rol `authenticated` + su claim `sub`) y comprueba qué
-- ve. Eso es exactamente lo que hace el navegador de esa persona.

-- ---------------------------------------------------------------------------
-- BLOQUE 1 — ¿quedaron las políticas esperadas en las 44 tablas?
-- Esperado: 44 filas, todas con permisiva=1, restrictiva=1 y ok=true.
-- ---------------------------------------------------------------------------
with tablas as (
  select unnest(array[
    'audit_log','biz_crm_contactos','business_assistant_messages','business_blindspots',
    'business_health_snapshots','business_profile','calculation_runs','ceo_reports',
    'decision_simulations','finance_abonos','finance_accounts','finance_budget_monthly',
    'finance_clientes','finance_config','finance_debt_payments','finance_debts',
    'finance_herramienta_servicios','finance_herramientas','finance_horas',
    'finance_otros_gastos','finance_pagos_egresos','finance_payables',
    'finance_payment_methods','finance_receivable_payments','finance_receivables',
    'finance_servicios','finance_ventas','marketing_campaign_metrics','marketing_campaigns',
    'onboarding_messages','operating_kpi_days','operating_kpi_settings','payment_gateways',
    'planner_behavior','planner_blocks','planner_briefings','planner_goals','planner_inbox',
    'planner_insights','planner_routines','planner_tasks','project_kpi_entries',
    'project_kpis','user_fiscal_profile'
  ]) as tabla
)
select t.tabla,
       count(*) filter (where p.permissive = 'PERMISSIVE')  as permisiva,
       count(*) filter (where p.permissive = 'RESTRICTIVE') as restrictiva,
       count(*) filter (where p.qual not like '%my_accessible_account_ids%') as sin_la_regla,
       (count(*) filter (where p.permissive = 'PERMISSIVE') = 1
        and count(*) filter (where p.permissive = 'RESTRICTIVE') = 1
        and count(*) filter (where p.qual not like '%my_accessible_account_ids%') = 0
        and bool_and(c.relrowsecurity)) as ok
  from tablas t
  left join pg_policies p on p.schemaname = 'public' and p.tablename = t.tabla
  left join pg_class c on c.oid = to_regclass('public.' || t.tabla)
 group by t.tabla
 order by ok, t.tabla;

-- ---------------------------------------------------------------------------
-- BLOQUE 2 — aislamiento real, usuario por usuario, sin escribir nada.
--
-- Para cada usuario de auth.users se hace pasar por él y cuenta, en las tablas
-- con datos, cuántas filas ve que NO son de una cuenta accesible para él.
-- Esperado: `filas_ajenas_visibles = 0` en TODAS las filas del resultado.
-- Si alguna da > 0, la migración abrió una fuga: aplica el rollback.
-- ---------------------------------------------------------------------------
do $$
declare
  ids uuid[];
  correos text[];
  i int;
  t text;
  ajenas bigint;
  accesibles uuid[];
  total_fugas bigint := 0;
  tablas text[] := array[
    'finance_ventas','finance_pagos_egresos','finance_horas','finance_clientes',
    'finance_servicios','finance_herramientas','finance_herramienta_servicios',
    'finance_abonos','finance_otros_gastos','planner_tasks','planner_blocks',
    'planner_inbox','biz_crm_contactos','business_profile','audit_log'
  ];
begin
  -- La lista de usuarios se materializa ANTES de cambiar de rol: `authenticated`
  -- no puede leer auth.users, y un cursor abierto se leería ya con ese rol.
  select array_agg(id order by created_at), array_agg(email order by created_at)
    into ids, correos
    from auth.users;

  for i in 1 .. coalesce(array_length(ids, 1), 0) loop
    -- Hacerse pasar por el usuario: mismo rol y mismo claim que usa el navegador.
    perform set_config('request.jwt.claims',
                       json_build_object('sub', ids[i], 'role', 'authenticated')::text,
                       true);
    set local role authenticated;

    select coalesce(array_agg(account_id), '{}'::uuid[])
      into accesibles
      from public.my_accessible_account_ids();

    foreach t in array tablas loop
      execute format(
        'select count(*) from public.%I where user_id is null or not (user_id = any($1))', t
      ) into ajenas using accesibles;

      if ajenas > 0 then
        total_fugas := total_fugas + ajenas;
        raise warning 'FUGA: % (%) ve % filas ajenas en %', correos[i], ids[i], ajenas, t;
      end if;
    end loop;

    reset role;
  end loop;

  reset role;
  if total_fugas = 0 then
    raise notice 'OK — ningún usuario ve filas de cuentas que no le corresponden.';
  else
    raise exception 'AISLAMIENTO ROTO: % filas ajenas visibles en total', total_fugas;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- BLOQUE 3 — el holding SÍ ve a sus empresas (cuando ya exista el árbol).
-- Devuelve, por cada miembro de organización, a qué cuentas llega.
-- Con organization_members vacía no devuelve filas: es lo esperado hasta que
-- des de alta el árbol.
-- ---------------------------------------------------------------------------
select m.user_id,
       (select email from auth.users au where au.id = m.user_id) as miembro,
       o.nombre as organizacion,
       m.rol,
       (select array_agg(hija.nombre order by hija.nombre)
          from public.organizations hija
         where hija.parent_org_id = o.id) as empresas_hijas,
       (select array_agg(distinct oo.nombre order by oo.nombre)
          from public.org_descendants(m.org_id) d
          join public.organizations oo on oo.id = d.id
         where oo.data_user_id is not null) as cuentas_alcanzadas
  from public.organization_members m
  join public.organizations o on o.id = m.org_id
 order by o.nombre, m.rol;
