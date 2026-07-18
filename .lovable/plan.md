# Plan de implementación — Ferova OS / Golden Access

Trabajo sobre el proyecto existente. No rediseño Home, Planner, Proyectos, CRM, asistente IA, ni el backup/import de Google Sheets. Cada fase entrega migraciones versionadas con RLS por `user_id`, tipos TS estrictos, servicios/hooks separados y UI integrada en la navegación actual (Home, Workspace, Projects, Modules, Settings).

## Fase 0 — Auditoría y fundaciones (sin UI nueva)
- Recorrer `supabase/migrations/`, `src/lib/*Service.ts`, `src/hooks/*`, `src/components/*` y `src/types.ts` para mapear qué existe.
- Confirmar compatibilidad con `financeService`, `plannerService`, `crmService`, `biService`, `reportsService`, `sheetsService`.
- Crear `src/lib/adminGuard.ts` unificado (email `gerencia@seoparaecommerce.co` + `crm_team_members`), reutilizado por rutas y edge functions.
- Tabla `admin_module_overrides` (por usuario, módulo, activo) para activación manual desde admin.

## Fase 1 — Perfil fiscal extensible (base para el resto)
- Migración `user_fiscal_profile`: `country` (default `CO`), `person_type` (`natural|juridica`), `regime` (`simple|ordinario`), `currency_base`, `updated_at`. RLS por `user_id`.
- Servicio `fiscalProfileService` + hook `useFiscalProfile`.
- Extender `ConfigAdmin` y `OnboardingChat` con los tres campos; Colombia queda como default.
- `calculations.ts` recibe el perfil como parámetro opcional; sin cambiar fórmulas actuales cuando `country === 'CO'`.

## Fase 2 — Finanzas operativas (núcleo del pedido)
Migraciones nuevas, ninguna alteración destructiva a `finance_*` actuales:
- `finance_payment_methods` (`tipo`: credito/debito/efectivo/transferencia/otro, `alias`, `activo`).
- `finance_accounts` (`tipo`: banco/efectivo/tarjeta_credito/credito_prestamo, `saldo_inicial`, `moneda`, `cupo`, `corte_dia`, `pago_dia`).
- `finance_debts` (`saldo_inicial`, `tasa`, `cuotas`, `fecha_corte`, `fecha_limite`, `estado`, `account_id`) + `finance_debt_payments`.
- `finance_receivables` (cliente_id, factura, valor, vencimiento, estado, saldo) + `finance_receivable_payments` (reusa `finance_abonos` donde aplique — sin migrar datos existentes).
- `finance_payables` (proveedor, factura, valor, vencimiento, fecha_pago_real, estado, diferencia calculada).
- `finance_budget_monthly` (`periodo YYYY-MM`, `categoria`, `monto_presupuestado`, `origen`: auto|manual).
- Servicios: `paymentMethodsService`, `accountsService`, `debtsService`, `receivablesService`, `payablesService`, `budgetService`, `cashflowService` (agrega ingresos reales + pendientes + gastos + obligaciones + pagos TC).
- UI: nuevas pestañas dentro del módulo Finanzas existente — `Cuentas`, `Deudas`, `Por cobrar`, `Por pagar`, `Presupuesto`, `Flujo de caja`. Sin tocar pestañas actuales.
- Alertas: función `buildFinanceAlerts` consumida por `NotificationsBell` (vencimientos, atraso, caja insuficiente, desvío de presupuesto).
- Semilla del presupuesto: primer mes se calcula desde `finance_pagos_egresos` + `finance_ventas` reales agrupados por categoría; luego editable.

## Fase 3 — Servicios y equilibrio ampliados
- Migración: añadir `incluye`, `no_incluye`, `precio_habitual`, `precio_ofrecido`, `costo_entrega_estimado`, `margen_objetivo` a `finance_servicios` (nullable, sin romper lecturas).
- `EquilibrioServicio`: calcular y mostrar `precio_ideal_recomendado = (costo_entrega / (1 - margen_objetivo)) + prorrateo estructura`.
- Preparar `market_reference_notes` (texto libre) para que la IA lo lea; sin scraping ni precios inventados.

## Fase 4 — Marketing ROI
- Migraciones: `marketing_campaigns` (nombre, canal, fechas, `account_id`, `payment_method_id`, `budget_link_id` → renglón presupuesto) y `marketing_campaign_metrics` (inversión, impresiones, clics, leads, leads_calificados, citas, citas_efectivas, ventas, ticket_prom, costo_entrega, comision, ltv, periodo).
- `roiService` calcula CPM, CTR, CPC, CPL, CPL calificado, tasas por etapa, fugas, CPA, ingresos, ROAS, utilidad neta, margen, ROI (= utilidad/inversión).
- Nuevo módulo `Marketing ROI` en el sidebar (bajo Modules): tabla de campañas, comparador hasta 5, calculadora inversa desde meta de facturación.
- Registrar inversión real dispara asiento en `finance_pagos_egresos` vinculado a método/cuenta.

## Fase 5 — Planner: bloques protegidos
- Añadir columna `protected boolean default false` a `planner_blocks` + migración.
- `planner-plan-day` respeta `protected=true` (no reubica).
- UI: badge "Protegido", toggle en creación manual. Resto del Planner intacto.

## Fase 6 — Administración SaaS
- Migraciones: `saas_user_events` (activación, uso por módulo, retención — agregable, sin PII sensible), `admin_courtesy_emails` (correo autorizado → plan gratis al registrarse).
- Trigger `handle_new_user_courtesy` que inserta `user_subscriptions` gratuita si el email está en `admin_courtesy_emails`.
- `AdminPanel` ampliado (ruta `/admin` existente, protegida): pestañas Feedback (con estados y respuesta visible al usuario en su `FeedbackWidget`), Usuarios (último acceso, plan, módulos, métricas básicas), Cortesías, Overrides de módulos, Analítica agregada.
- Los módulos visibles se resuelven en `getModules(plan, isTeam, overrides)`.

## Fase 7 — Planes provisionales y pagos (sin cobros reales)
- Tabla `saas_plans` editable desde admin (id, nombre, precio_provisional, módulos incluidos, activo, marcado `provisional=true`).
- UI Paywall muestra planes desde BD, badge "Precio provisional".
- Interfaz `PaymentProvider` con implementación `PaddleProvider` stub (sin claves, sin confirmar pagos). Feature flag `PAYMENTS_ENABLED=false`.

## Fase 8 — UX/calidad final
- Home ≤ 5 KPIs (auditar y recortar).
- Asistente IA único, colapsable, con historial limitado (localStorage con cap) y botón "Borrar conversación".
- Barrido de botones/tarjetas sin acción → conectar o eliminar.
- Responsive check en móvil/tablet/desktop.
- `npm run lint` + `tsc --noEmit` limpios.
- Reporte final: migraciones, archivos modificados, decisiones, pruebas manuales por fase.

## Detalles técnicos

### Convenciones de migración
- Cada tabla nueva: `CREATE TABLE` → `GRANT SELECT,INSERT,UPDATE,DELETE ... TO authenticated` + `GRANT ALL ... TO service_role` → `ENABLE RLS` → policy `auth.uid() = user_id`.
- Índices en `(user_id, fecha)`, `(user_id, estado)`, FKs a `finance_clientes/servicios/accounts/payment_methods`.
- Timestamps `created_at`/`updated_at` con trigger `update_updated_at_column` existente.

### Convenciones de código
- Tipos en `src/types.ts` o `src/domains/<dominio>/types.ts`.
- Servicios en `src/lib/*Service.ts`, hooks en `src/hooks/*`, UI sin fetch directo.
- Sin `any` en límites nuevos; reusar patrón de `financeService`.
- Cálculos deterministas fuera de componentes (`src/lib/*Calc.ts`).

### Riesgos y mitigación
- Cambios en `finance_servicios`: columnas nullable → lecturas actuales no rompen.
- `is_team_member()` y RLS existentes se preservan; se añaden policies nuevas, no se reemplazan.
- Sin datos simulados: seeds solo para el propio usuario admin desde su UI.

## Entrega por fase
Al terminar cada fase respondo con: migraciones creadas, archivos tocados, decisiones tomadas y checklist de prueba manual. Espero tu "ok" para seguir a la siguiente.

¿Arranco con **Fase 0 + Fase 1** (auditoría + perfil fiscal), o preferís que empiece directo por **Fase 2 (Finanzas operativas)** que es el bloque más grande del pedido?
