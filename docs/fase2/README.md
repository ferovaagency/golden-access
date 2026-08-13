# Fase 2 — Modelo de organizaciones (borrador para STAGING)

> ⚠️ **NO copiar a `supabase/migrations/` todavía.** Estos scripts se prueban
> primero en **staging** con un **respaldo verificado inmediatamente antes**.
> Una migración de este tamaño no se deshace. Hoy el sistema es mono-tenant por
> `user_id` y cada cliente ya está aislado; esto habilita que varias personas
> compartan los datos de UNA organización sin verse entre organizaciones.

## Prerrequisitos
1. Proyecto/branch de **staging** con una copia de datos reales.
2. **Backup verificado** tomado justo antes de correr.
3. Correr en orden: `01` → `06`. Después, `06` (pgTAP) debe pasar en verde.

## Concepto
Dos ejes de acceso:
- `(org_id, owner_user_id IS NULL)` = datos/cerebro de la **organización** (los ve todo el equipo de esa org).
- `(org_id, owner_user_id = X)` = datos/cerebro **personales** dentro de esa org.

La organización activa de quien consulta la da `current_org_id()` (tabla `user_active_org`).
Las políticas RLS de organización se declaran **`as restrictive`**: se combinan con AND
y actúan de red de seguridad aunque luego se agregue por error una política muy abierta.

## Categorización de tablas (REVISAR antes de correr)

**Tenant — llevan `org_id` y RLS por organización** (datos del negocio, compartibles):
finance_abonos, finance_accounts, finance_budget_monthly, finance_clientes,
finance_config, finance_debt_payments, finance_debts, finance_herramienta_servicios,
finance_herramientas, finance_horas, finance_otros_gastos, finance_pagos_egresos,
finance_payables, finance_payment_methods, finance_receivable_payments,
finance_receivables, finance_servicios, finance_ventas, planner_behavior,
planner_blocks, planner_briefings, planner_goals, planner_inbox, planner_insights,
planner_routines, planner_tasks, biz_crm_contactos, marketing_campaigns,
marketing_campaign_metrics, project_kpis, project_kpi_entries, operating_kpi_days,
operating_kpi_settings, ceo_reports, decision_simulations, business_blindspots,
business_health_snapshots, calculation_runs, audit_log, business_profile,
business_assistant_messages, onboarding_messages, ferova_knowledge.

**Se quedan user-scoped (NO org)** — cuenta/sistema por persona:
user_subscriptions (facturación), user_notifications, google_workspace_connections
(cada quien conecta su propio Google), ai_usage_log (sistema), saas_user_events
(analítica), product_feedback, admin_module_overrides.

**Ambiguas — DECIDIR antes de correr** (no incluidas en los scripts hasta decidir):
- `user_fiscal_profile`: ¿el perfil fiscal es del negocio (org) o de la persona? Probable **org**.
- `payment_gateways`: pasarelas del negocio para SUS ventas → probable **org**.
- `crm_whatsapp_instances`: WhatsApp del negocio → probable **org**.
- `collaborators` (owner_user_id): es el modelo VIEJO de colaboración; queda
  **reemplazado** por `organization_members`. Migrar sus filas y luego retirarla.
- `business_profile`: es 1-por-usuario hoy; al pasar a org, debería ser
  **1-por-organización**. Requiere decidir la unicidad (ver nota en `02`).

## Archivos
- `01_core.sql` — organizations, organization_members, user_active_org, current_org_id().
- `02_org_id_columns.sql` — agrega `org_id` a las tablas tenant.
- `03_backfill.sql` — crea la org "Ferova", sus miembros, setea `org_id` y la org activa.
- `04_match_ferova_knowledge_org.sql` — filtra el cerebro por `org_id`.
- `05_rls_org_policies.sql` — política restrictiva de organización por tabla tenant.
- `06_pgtap_isolation.sql` — pruebas de aislamiento (dos orgs no se ven).

## Verificación mínima tras correr
1. `06_pgtap_isolation.sql` en verde.
2. Con dos usuarios de orgs distintas: ninguno lee/escribe datos del otro.
3. El asistente y `match_ferova_knowledge` solo devuelven cerebro de la org activa.
4. La app arranca y los datos existentes aparecen bajo la org "Ferova".
