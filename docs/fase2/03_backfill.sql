-- Fase 2 · 03 · Backfill. Correr en STAGING primero. ES LA PARTE MÁS DELICADA:
-- revisa la lógica contra tu realidad antes de correr en producción.
--
-- Estrategia por defecto: CADA usuario con datos = SU PROPIA organización (cada
-- cliente del SaaS es su propio tenant). El equipo interno de Ferova, que HOY
-- comparte datos por crm_team_members, es la excepción: se fusiona a mano en una
-- sola org "Ferova" al final (ver PASO 4).

-- PASO 1 — Una org por cada usuario que tenga perfil de negocio.
insert into public.organizations (id, nombre)
select gen_random_uuid(), coalesce(nullif(bp.nombre_negocio,''), 'Mi negocio')
from public.business_profile bp
on conflict do nothing;

-- Mapa user_id -> org_id. (Se apoya en que cada business_profile es 1-por-usuario.)
create temporary table _org_map as
select bp.user_id, o.id as org_id
from public.business_profile bp
join public.organizations o
  on o.nombre = coalesce(nullif(bp.nombre_negocio,''), 'Mi negocio')
-- Si dos negocios tienen el mismo nombre, este join los cruza mal: revisa
-- duplicados de nombre ANTES de correr (o crea las orgs con un id determinístico
-- por user_id en vez de por nombre).
;

-- PASO 2 — Miembros y org activa (el dueño de los datos es owner de su org).
insert into public.organization_members (org_id, user_id, rol)
select org_id, user_id, 'owner' from _org_map
on conflict do nothing;

insert into public.user_active_org (user_id, org_id)
select user_id, org_id from _org_map
on conflict (user_id) do update set org_id = excluded.org_id;

-- PASO 3 — Backfill de org_id en las tablas tenant (por user_id).
do $$
declare
  t text;
  tenant_tables text[] := array[
    'finance_abonos','finance_accounts','finance_budget_monthly','finance_clientes',
    'finance_config','finance_debt_payments','finance_debts','finance_herramienta_servicios',
    'finance_herramientas','finance_horas','finance_otros_gastos','finance_pagos_egresos',
    'finance_payables','finance_payment_methods','finance_receivable_payments',
    'finance_receivables','finance_servicios','finance_ventas','planner_behavior',
    'planner_blocks','planner_briefings','planner_goals','planner_inbox','planner_insights',
    'planner_routines','planner_tasks','biz_crm_contactos','marketing_campaigns',
    'marketing_campaign_metrics','project_kpis','project_kpi_entries','operating_kpi_days',
    'operating_kpi_settings','ceo_reports','decision_simulations','business_blindspots',
    'business_health_snapshots','calculation_runs','audit_log','business_profile',
    'business_assistant_messages','onboarding_messages'
  ];
begin
  foreach t in array tenant_tables loop
    execute format(
      'update public.%I x set org_id = m.org_id from _org_map m where x.user_id = m.user_id and x.org_id is null;', t);
  end loop;
end $$;

-- ferova_knowledge usa owner_user_id (NULL = cerebro global de equipo).
-- El cerebro con dueño va a la org de ese dueño; el global (owner NULL) queda
-- para asignar en el PASO 4 (equipo Ferova).
update public.ferova_knowledge k
set org_id = m.org_id
from _org_map m
where k.owner_user_id = m.user_id and k.org_id is null;

-- PASO 4 — MANUAL: equipo interno de Ferova.
-- Los miembros de crm_team_members comparten datos hoy. Decidir a mano:
--   a) crear la org "Ferova", b) agregar a esos usuarios como members,
--   c) fijar su user_active_org a "Ferova", d) reasignar el cerebro global
--      (ferova_knowledge.owner_user_id IS NULL) a esa org.
-- Ejemplo (ajustar ids reales):
--   with f as (insert into public.organizations(nombre) values ('Ferova') returning id)
--   update public.ferova_knowledge set org_id = (select id from f) where owner_user_id is null and org_id is null;

drop table if exists _org_map;

-- VERIFICAR antes de seguir: que no queden filas tenant con org_id NULL
-- (salvo el cerebro global pendiente del PASO 4).
