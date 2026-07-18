# Ferova OS — Database

## Autoridad y seguridad

Supabase Postgres es la fuente de registro. `supabase/migrations/` es la definición canónica del esquema; los tipos generados son artefactos de consumo.

- Las tablas creadas habilitan RLS.
- Los datos de cliente se asocian normalmente con `user_id = auth.uid()`.
- El CRM interno usa `crm_team_members` e `is_team_member()`.
- Las funciones con `SUPABASE_SERVICE_ROLE_KEY` evaden RLS y deben autorizar explícitamente.

## Dominios

| Dominio | Tablas |
|---|---|
| Finanzas | `finance_config`, `finance_clientes`, `finance_servicios`, `finance_herramientas`, `finance_herramienta_servicios`, `finance_otros_gastos`, `finance_pagos_egresos`, `finance_ventas`, `finance_abonos`, `finance_horas` |
| Acceso/perfil | `user_subscriptions`, `courtesy_access_grants`, `google_workspace_connections`, `business_profile`, `onboarding_messages`, `product_feedback` |
| CRM interno | `crm_team_members`, `crm_oportunidades`, `crm_interacciones`, `crm_citas_diagnostico`, `crm_contenido_potencial`, `crm_bot_config`, `crm_bot_knowledge`, `crm_whatsapp_instances`, `crm_review_sources`, `crm_resenas` |
| CRM cliente | `biz_crm_contactos` |
| Planner | `planner_inbox`, `planner_tasks`, `planner_blocks`, `planner_routines`, `planner_goals`, `planner_behavior`, `planner_insights`, `planner_briefings` |
| BI/dirección | `business_health_snapshots`, `business_blindspots`, `ceo_reports`, `decision_simulations` |

## Flujos

```text
UI → servicio de dominio → tablas Supabase → estado React
Google Sheets → importación → AppData normalizado → financeService
Equipo Ferova → crmService / Edge Functions → crm_* tables
Planner/BI → funciones IA → tablas planner, business y reportes
```

## Reglas de migración

1. No cambiar producción fuera de una migración.
2. Toda tabla multiusuario define ownership, RLS, políticas e índices.
3. Revisar todo uso de service role contra autorización de función.
4. Indexar rutas verificadas por usuario, fecha, estado y claves foráneas.
5. No introducir credenciales externas en campos legibles desde navegador.
6. Mantener compatibilidad de tipos durante migraciones del cliente.
