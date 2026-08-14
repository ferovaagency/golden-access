-- Fase 2 — acceso por organización en las tablas de negocio.
--
-- QUÉ CAMBIA
-- Hoy cada tabla de negocio tiene una política `auth.uid() = user_id` y, en 23
-- de ellas, una segunda `is_collaborator_of(user_id)`. Este archivo las
-- sustituye por UNA sola regla, igual en las 44 tablas:
--
--     user_id in (select account_id from public.my_accessible_account_ids())
--
-- Ese conjunto es exactamente el de hoy MÁS una rama nueva:
--   1. mi propia cuenta                     (= auth.uid() = user_id de hoy)
--   2. cuentas donde soy colaborador activo (= is_collaborator_of de hoy)
--   3. cuentas de organizaciones donde mando (owner/admin), directamente o
--      desde un ancestro: el holding sobre sus empresas.  ← LA ÚNICA NUEVA
--
-- POR QUÉ NO SE AÑADE `org_id` A LAS 44 TABLAS
-- El puente con el modelo de organizaciones ya existe: `organizations.data_user_id`
-- (ver 20260814120000_organizations_base.sql). Con él, la tenencia se resuelve sin
-- tocar ni una columna de datos, ni una clave primaria — y 11 de estas tablas
-- tienen PK compuesta `(user_id, id)`, así que añadir `org_id` como dimensión
-- canónica significaría reescribir claves primarias sobre datos reales. Eso se
-- hace el día que UNA empresa necesite varias filas de tenencia distintas dentro
-- de la misma cuenta; hoy no es el caso y no compra nada.
--
-- CON `organization_members` VACÍA ESTA MIGRACIÓN NO CAMBIA EL COMPORTAMIENTO DE
-- NADIE: la rama 3 no concede nada hasta que se inserten filas a conciencia.
--
-- Reversible: docs/fase2/rollback_org_account_rls.sql
-- Verificación: docs/fase2/verificacion_org_account_rls.sql

-- 1) El conjunto de cuentas sobre las que puede operar quien consulta ---------
--
-- Devuelve un CONJUNTO (no un booleano por fila) a propósito: usada como
-- `user_id in (select …)`, Postgres la evalúa una vez por consulta (InitPlan) y
-- no una vez por fila. `can_access_account(uuid)` sigue existiendo para llamadas
-- puntuales; esta es su versión para políticas.
--
-- SECURITY DEFINER porque lee organization_members / organizations, cuyas
-- propias políticas llamarían de vuelta a la función.

create or replace function public.my_accessible_account_ids()
returns table (account_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  -- 1. mi propia cuenta
  select auth.uid() where auth.uid() is not null
  union
  -- 2. cuentas donde soy colaborador activo (modelo anterior, se conserva)
  select c.owner_user_id
    from public.collaborators c
   where c.user_id = auth.uid()
     and c.activo
  union
  -- 3. cuentas de las organizaciones donde mando, incluidas las descendientes
  select o.data_user_id
    from public.organization_members m
    cross join lateral public.org_descendants(m.org_id) d
    join public.organizations o on o.id = d.id
   where m.user_id = auth.uid()
     and m.rol in ('owner', 'admin')
     and o.data_user_id is not null;
$$;

revoke all on function public.my_accessible_account_ids() from public, anon;
grant execute on function public.my_accessible_account_ids() to authenticated, service_role;

-- 2) Reescritura de las políticas -------------------------------------------
--
-- El bucle borra TODAS las políticas de cada tabla listada y deja dos:
--   · "tenant access"    (permissive)  — concede el acceso.
--   · "tenant isolation" (restrictive) — red de seguridad: las restrictivas se
--     combinan con AND, así que si mañana alguien añade por error una política
--     permisiva demasiado abierta, esta sigue exigiendo que la fila sea de una
--     cuenta accesible.
--
-- Sólo se tocan las tablas de esta lista. Quedan FUERA a propósito:
--   user_subscriptions, user_notifications, google_workspace_connections,
--   ai_usage_log, saas_user_events, product_feedback, admin_module_overrides,
--   crm_team_members, collaborators  → son de la PERSONA o del sistema, no del
--   negocio: la facturación de un socio no la ve el holding.
--   crm_* (9 tablas) y crm_whatsapp_instances → CRM interno de Ferova, protegido
--   por is_team_member(); no son datos de cliente.

do $$
declare
  t text;
  p record;
  tablas text[] := array[
    'audit_log',
    'biz_crm_contactos',
    'business_assistant_messages',
    'business_blindspots',
    'business_health_snapshots',
    'business_profile',
    'calculation_runs',
    'ceo_reports',
    'decision_simulations',
    'finance_abonos',
    'finance_accounts',
    'finance_budget_monthly',
    'finance_clientes',
    'finance_config',
    'finance_debt_payments',
    'finance_debts',
    'finance_herramienta_servicios',
    'finance_herramientas',
    'finance_horas',
    'finance_otros_gastos',
    'finance_pagos_egresos',
    'finance_payables',
    'finance_payment_methods',
    'finance_receivable_payments',
    'finance_receivables',
    'finance_servicios',
    'finance_ventas',
    'marketing_campaign_metrics',
    'marketing_campaigns',
    'onboarding_messages',
    'operating_kpi_days',
    'operating_kpi_settings',
    'payment_gateways',
    'planner_behavior',
    'planner_blocks',
    'planner_briefings',
    'planner_goals',
    'planner_inbox',
    'planner_insights',
    'planner_routines',
    'planner_tasks',
    'project_kpi_entries',
    'project_kpis',
    'user_fiscal_profile'
  ];
begin
  foreach t in array tablas loop
    -- Si la tabla no existe, se salta: el archivo no debe fallar a medias.
    if to_regclass('public.' || quote_ident(t)) is null then
      raise notice 'Tabla ausente, se omite: %', t;
      continue;
    end if;

    -- Guardarraíl: sin columna user_id la regla no aplica y borrar sus
    -- políticas dejaría la tabla sin protección.
    if not exists (
      select 1 from information_schema.columns
       where table_schema = 'public' and table_name = t and column_name = 'user_id'
    ) then
      raise exception 'La tabla % no tiene user_id: revisa la lista', t;
    end if;

    execute format('alter table public.%I enable row level security', t);

    for p in
      select policyname from pg_policies where schemaname = 'public' and tablename = t
    loop
      execute format('drop policy %I on public.%I', p.policyname, t);
    end loop;

    execute format($f$
      create policy "tenant access" on public.%I
        for all to authenticated
        using (user_id in (select account_id from public.my_accessible_account_ids()))
        with check (user_id in (select account_id from public.my_accessible_account_ids()))
    $f$, t);

    execute format($f$
      create policy "tenant isolation" on public.%I
        as restrictive for all to authenticated
        using (user_id in (select account_id from public.my_accessible_account_ids()))
        with check (user_id in (select account_id from public.my_accessible_account_ids()))
    $f$, t);
  end loop;
end $$;
