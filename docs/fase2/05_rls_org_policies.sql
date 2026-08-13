-- Fase 2 · 05 · RLS por organización. Correr en STAGING primero.
--
-- DOS partes:
--  A) Red de seguridad RESTRICTIVE por org (segura de agregar; se combina con AND
--     y evita fugas entre organizaciones aunque una política permisiva sea amplia).
--  B) Reemplazo de las políticas PERMISSIVE user-based por org-based (necesario
--     para que el equipo de una org SÍ comparta datos). Esto último toca las
--     políticas existentes de cada tabla, que hay que revisar una por una — por
--     eso va como PATRÓN documentado, no en bucle a ciegas.

-- ---------- PARTE A: red de seguridad restrictiva (segura) ----------
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
    execute format('drop policy if exists org_isolation on public.%I;', t);
    execute format(
      'create policy org_isolation on public.%I as restrictive for all
         using (org_id = public.current_org_id())
         with check (org_id = public.current_org_id());', t);
  end loop;
end $$;

-- ---------- PARTE B: PATRÓN para las permissive (revisar por tabla) ----------
-- Hoy cada tabla tiene una política permisiva tipo (user_id = auth.uid()) que, con
-- orgs, IMPIDE que otro miembro de la misma org vea los datos. Hay que cambiarla a
-- pertenencia por org. Antes de correr, lista las políticas actuales:
--   select tablename, policyname, cmd, qual, with_check
--   from pg_policies where schemaname='public' and tablename = 'finance_ventas';
--
-- Y reemplaza (EJEMPLO para finance_ventas; repetir por tabla con el nombre real):
--   drop policy if exists "<nombre_actual_user_based>" on public.finance_ventas;
--   create policy org_rw on public.finance_ventas
--     for all
--     using (public.is_org_member(org_id))
--     with check (public.is_org_member(org_id));
--
-- Caso especial ferova_knowledge (cerebro): global de la org vs privado del usuario.
--   drop policy if exists "<nombre_actual>" on public.ferova_knowledge;
--   create policy brain_rw on public.ferova_knowledge
--     for all
--     using (public.is_org_member(org_id)
--            and (owner_user_id is null or owner_user_id = auth.uid()))
--     with check (public.is_org_member(org_id)
--            and (owner_user_id is null or owner_user_id = auth.uid()));
--
-- Nota: la app debe empezar a ESCRIBIR org_id en cada insert (o un trigger
-- BEFORE INSERT que lo complete desde current_org_id()). Recomendado el trigger
-- para no tocar decenas de servicios:
--   create or replace function public.set_org_id() returns trigger
--     language plpgsql security definer set search_path='' as $f$
--     begin if new.org_id is null then new.org_id := public.current_org_id(); end if; return new; end $f$;
--   -- luego, por tabla tenant:
--   -- create trigger trg_set_org before insert on public.<tabla>
--   --   for each row execute function public.set_org_id();
