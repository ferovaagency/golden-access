-- Fase 2 · 02 · Agrega org_id a las tablas tenant. Nullable ahora; se backfillea
-- en 03 y luego puede volverse NOT NULL. Correr en STAGING primero.

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
    'business_assistant_messages','onboarding_messages','ferova_knowledge'
  ];
begin
  foreach t in array tenant_tables loop
    execute format('alter table public.%I add column if not exists org_id uuid references public.organizations(id);', t);
    execute format('create index if not exists %I on public.%I(org_id);', t || '_org_idx', t);
  end loop;
end $$;

-- NOTA business_profile: hoy es 1-por-usuario. Al pasar a org, decidir si pasa a
-- ser 1-por-ORGANIZACIÓN (recomendado). Si se decide así, tras el backfill:
--   - deduplicar por org_id y crear unique(org_id).
-- No se fuerza aquí para no romper datos sin esa decisión.
