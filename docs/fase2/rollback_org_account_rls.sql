-- VUELTA ATRÁS de 20260814180000_org_account_rls.sql
--
-- Restaura el comportamiento anterior: cada quien ve sólo su cuenta, más los
-- colaboradores activos en las 20 tablas que lo tenían. El holding deja de ver
-- a sus empresas desde el navegador (la edge function holding-overview sigue
-- funcionando: usa service_role).
--
-- Los NOMBRES de las políticas no son idénticos a los originales (los antiguos
-- eran inconsistentes: "own accounts", "finance_ventas own", "pk_all"…); las
-- REGLAS sí lo son. Si te importa el nombre exacto, están en el historial de
-- git de este archivo y en la salida de la verificación previa.
--
-- Pégalo entero en el chat de Lovable pidiendo que lo ejecute tal cual.

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
  -- Las 23 que además tenían política de colaborador.
  con_colaborador text[] := array[
    'finance_abonos','finance_accounts','finance_budget_monthly','finance_clientes',
    'finance_config','finance_debt_payments','finance_debts','finance_herramienta_servicios',
    'finance_herramientas','finance_horas','finance_otros_gastos','finance_pagos_egresos',
    'finance_payables','finance_payment_methods','finance_receivable_payments',
    'finance_receivables','finance_servicios','finance_ventas','planner_blocks',
    'planner_inbox','planner_tasks','project_kpi_entries','project_kpis'
  ];
begin
  foreach t in array tablas loop
    if to_regclass('public.' || quote_ident(t)) is null then
      continue;
    end if;

    for p in select policyname from pg_policies where schemaname='public' and tablename=t loop
      execute format('drop policy %I on public.%I', p.policyname, t);
    end loop;

    execute format($f$
      create policy "%s own" on public.%I
        for all to authenticated
        using (auth.uid() = user_id)
        with check (auth.uid() = user_id)
    $f$, t, t);

    if t = any (con_colaborador) then
      execute format($f$
        create policy "collab_shared_%s" on public.%I
          for all to authenticated
          using (public.is_collaborator_of(user_id))
          with check (public.is_collaborator_of(user_id))
      $f$, t, t);
    end if;
  end loop;
end $$;

-- La función se puede dejar: sin políticas que la usen no concede nada.
-- Si prefieres borrarla del todo:
-- drop function if exists public.my_accessible_account_ids();
