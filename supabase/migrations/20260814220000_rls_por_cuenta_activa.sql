-- Fase 2 (corrección) — la RLS devuelve UNA cuenta: la activa.
--
-- QUÉ ESTABA MAL
-- 20260814180000 dejó la regla como `user_id in (select account_id from
-- my_accessible_account_ids())`, o sea la UNIÓN de todas las cuentas
-- alcanzables. Eso rompe una suposición que atraviesa toda la aplicación: el
-- código asume que la RLS ya devuelve "mis filas" y por eso muchas consultas no
-- filtran por user_id (plannerService hace 35 consultas y ninguna filtra).
--
-- Con la unión, en cuanto exista el árbol del holding:
--   · `business_profile ... maybeSingle()` falla, porque hay más de una fila;
--   · las listas del planner mezclan tareas de varias empresas sin distinguir.
--
-- Hoy no se nota porque organization_members está vacía y la unión tiene un solo
-- elemento. Se corrige ANTES de encender el holding, no después.
--
-- LA REGLA NUEVA
--   using / with check:  user_id = (select public.current_account_id())
--
-- `current_account_id()` es la cuenta sobre la que la persona está trabajando
-- ahora mismo, validada contra el conjunto de cuentas a las que tiene derecho.
-- El conjunto (`my_accessible_account_ids`) sigue existiendo, pero pasa a ser lo
-- que era: la autorización de QUÉ puedes activar, no lo que ves de golpe.
--
-- Consecuencia buscada: cambiar de empresa en el selector cambia lo que ve toda
-- la aplicación, en un solo sitio, y el código existente sigue siendo correcto
-- sin tocar una consulta. La vista consolidada del holding (varias empresas a la
-- vez) no se hace desde el navegador: para eso está la edge function
-- `holding-overview`, que usa service_role y autoriza explícitamente.
--
-- El `(select ...)` alrededor de la función no es cosmético: hace que Postgres
-- la evalúe UNA vez por consulta (InitPlan) y no una vez por fila.

-- 1) El espacio de trabajo activo puede ser una cuenta sin organización -------
--
-- Un colaborador invitado a otro negocio no tiene organización: su espacio de
-- trabajo es directamente una cuenta. Por eso se guarda la CUENTA activa, y la
-- organización queda como dato acompañante (la necesita el cerebro para saber
-- hacia dónde puede viajar una nota).

alter table public.user_active_org
  add column if not exists account_user_id uuid;

alter table public.user_active_org
  alter column org_id drop not null;

-- Filas anteriores: la cuenta es la de la organización que tenían guardada.
update public.user_active_org a
   set account_user_id = o.data_user_id
  from public.organizations o
 where o.id = a.org_id
   and a.account_user_id is null;

-- 2) La cuenta activa, validada -----------------------------------------------

create or replace function public.current_account_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select a.account_user_id
       from public.user_active_org a
      where a.user_id = auth.uid()
        and a.account_user_id is not null
        -- La validación es lo que impide que guardar una fila cualquiera en
        -- user_active_org sirva para leer datos ajenos.
        and a.account_user_id in (select account_id from public.my_accessible_account_ids())),
    auth.uid());
$$;

revoke all on function public.current_account_id() from public, anon;
grant execute on function public.current_account_id() to authenticated, service_role;

-- 3) Política de user_active_org: sólo puedes activar lo tuyo ----------------

drop policy if exists "active org own" on public.user_active_org;
create policy "active workspace own" on public.user_active_org
  for all to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and (account_user_id is null or account_user_id in (select account_id from public.my_accessible_account_ids()))
    and (org_id is null or org_id in (select id from public.my_accessible_org_ids()))
  );

-- 4) Las 44 tablas de negocio, a la cuenta activa ----------------------------

do $$
declare
  t text;
  p record;
  tablas text[] := array[
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
  ];
begin
  foreach t in array tablas loop
    if to_regclass('public.' || quote_ident(t)) is null then
      raise notice 'Tabla ausente, se omite: %', t;
      continue;
    end if;
    if not exists (
      select 1 from information_schema.columns
       where table_schema = 'public' and table_name = t and column_name = 'user_id'
    ) then
      raise exception 'La tabla % no tiene user_id: revisa la lista', t;
    end if;

    execute format('alter table public.%I enable row level security', t);

    for p in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy %I on public.%I', p.policyname, t);
    end loop;

    execute format($f$
      create policy "tenant access" on public.%I
        for all to authenticated
        using (user_id = (select public.current_account_id()))
        with check (user_id = (select public.current_account_id()))
    $f$, t);

    -- Restrictiva: se combina con AND, así que sigue exigiendo la cuenta activa
    -- aunque mañana alguien añada por error una política permisiva muy abierta.
    execute format($f$
      create policy "tenant isolation" on public.%I
        as restrictive for all to authenticated
        using (user_id = (select public.current_account_id()))
        with check (user_id = (select public.current_account_id()))
    $f$, t);
  end loop;
end $$;

-- 5) El contexto que leen las edge functions, alineado ------------------------

create or replace function public.active_context_for_user(p_user uuid)
returns table (account_id uuid, org_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  with elegida as (
    select a.org_id, a.account_user_id
      from public.user_active_org a
     where a.user_id = p_user
       and a.account_user_id is not null
       and (
         a.account_user_id = p_user
         or exists (
           select 1 from public.collaborators c
            where c.user_id = p_user and c.activo and c.owner_user_id = a.account_user_id
         )
         or exists (
           select 1
             from public.organization_members m
             cross join lateral public.org_descendants(m.org_id) d
             join public.organizations o on o.id = d.id
            where m.user_id = p_user
              and m.rol in ('owner','admin')
              and o.data_user_id = a.account_user_id
         )
       )
     limit 1
  )
  select coalesce((select account_user_id from elegida), p_user) as account_id,
         (select org_id from elegida)                            as org_id;
$$;

revoke all on function public.active_context_for_user(uuid) from public, anon, authenticated;
grant execute on function public.active_context_for_user(uuid) to service_role;
