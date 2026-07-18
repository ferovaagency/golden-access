# Ferova OS → AI-First Business Operating System

El alcance es enorme (15+ módulos). Lo divido en 5 fases entregables. Cada fase queda funcional en producción antes de pasar a la siguiente. Sin placeholders, sin TODOs, todo conectado a datos reales.

---

## Fase 1 — Business Intelligence Engine + Health Score

**Backend**
- Migración: tabla `business_health_snapshots` (score 0-100, sub-scores, deltas, explicación IA, generada diariamente).
- Vista materializada `business_intel_context` que agrega finance + CRM + planner + horas + proyectos en un único payload optimizado.
- Edge function `bi-compute-health`: calcula 10 sub-scores (cash flow, profitability, revenue growth, retention, project performance, invoices, time mgmt, task completion, pipeline, workload) con fórmulas deterministas + resumen IA de por qué cambió.
- Edge function `bi-detect-blindspots`: reemplaza `planner-insights` con detector estructurado (14 categorías: clients-at-risk, revenue-concentration, cash-risk, late-invoices, project-hours-overrun, low-margin-projects, employee-overload, unused-capacity, no-followup, postponed-tasks, marketing-inactive, low-sales-activity, bottlenecks, opportunities). Cada insight: `why`, `impact`, `action`, `urgency`.
- Cron pg_cron: recalcular health + blindspots diariamente 6am hora local del usuario.

**Frontend**
- `src/components/BusinessHealthCard.tsx`: gauge visual del score en Home con delta vs. ayer y top 3 razones.
- `src/components/BlindSpotsPanel.tsx`: reemplaza `InsightsCard`, agrupado por urgencia, cada tarjeta con acción CTA que navega al módulo relevante.
- Nueva sección "Salud del negocio" arriba del Home.

## Fase 2 — CEO Reports (Daily / Weekly / Monthly) + Decision Support

**Backend**
- Tabla `ceo_reports` (type: daily|weekly|monthly, payload JSON, generated_at).
- Edge function `ceo-report-generate` con 3 modos: daily (priorities/cash/meetings/risks/wins), weekly (ingresos/gastos/profit/pipeline/día más productivo), monthly (executive summary en lenguaje simple).
- Programación diaria/semanal/mensual con pg_cron.
- Ampliar `business-assistant-chat` con tools que responden preguntas de Decision Support consultando datos reales (`why_profits_lower`, `most_profitable_client`, `losing_project`, `service_to_stop`, `overloaded_employee`, `today_priority`, `waste_time`, `waste_money`).

**Frontend**
- Nueva ruta `/reports` con timeline de reportes generados, expandibles, exportables a PDF.
- Notificación en Home cuando hay reporte nuevo sin leer.
- Chat sidebar: chips con preguntas frecuentes de Decision Support.

## Fase 3 — Automations + Smart Notifications + Command Palette

**Backend**
- Tabla `automations` (trigger, condition, action, natural_language, enabled).
- Tabla `automation_runs` (log).
- Tabla `notifications` (type, severity, entity_ref, read_at) — solo lo importante.
- Edge function `automation-parse`: convierte texto natural ("cuando una venta se gane, crear proyecto") en trigger+action estructurado.
- Edge function `automation-execute`: dispatcher que corre en pg_cron cada 5 min + triggers DB (`AFTER INSERT` en ventas/proyectos/pagos → NOTIFY → edge function).
- Detector de patrones repetitivos → sugiere automatizaciones en Home.

**Frontend**
- Nueva ruta `/automations`: lista + creación con lenguaje natural.
- `src/components/CommandPalette.tsx` (⌘K / Ctrl+K): fuse.js sobre clientes/proyectos/tareas/facturas + acciones (crear cliente, ir a finanzas, preguntar a IA, generar reporte).
- Notification bell en topbar con solo alertas críticas.

## Fase 4 — Global Search + Activity Timeline + File Management + Sheets Backup

**Backend**
- Migración: extensión `pg_trgm` + índices GIN sobre nombre/notas de todas las entidades.
- Vista `global_search_index` unificada.
- Tabla `activity_events` (source, entity_type, entity_id, actor, verb, payload). Triggers DB en inserts/updates clave.
- Tabla `attachments` (entity_type, entity_id, file_url, uploaded_by). Bucket storage `attachments` (privado, RLS por dueño).
- Tabla `backup_logs` + edge function `backup-to-sheets` (usa Google Sheets connector del usuario: crea un spreadsheet con pestaña por tabla, timestamps, log).
- Programación manual/daily/weekly/monthly con pg_cron.

**Frontend**
- Command palette de Fase 3 se conecta al índice global.
- `src/components/ActivityTimeline.tsx` en Home + filtros.
- Componente `AttachmentsPanel` reutilizable, embebido en Clientes/Proyectos/Facturas/Tareas.
- UI de backup en Settings con schedule + historial.

## Fase 5 — Settings redesign + Offline scaffolding + Audit final

**Frontend**
- Rediseño de Settings en 9 tabs (Company, Appearance, Integrations, Notifications, AI, Security, Billing, Backup, Accessibility).
- Offline: manifest.webmanifest + service worker con `vite-plugin-pwa` (network-first HTML, cache-first assets, IndexedDB para lectura offline de finance/CRM/planner via `react-query` persistence).

**Auditoría de calidad**
- `bunx tsgo` — cero errores.
- `bunx eslint .` — cero warnings.
- Barrido: eliminar `console.log`, código duplicado, imports rotos, componentes muertos.
- Verificar bundle: lazy loading en todas las rutas pesadas (Admin, Reports, Automations, Planner).
- Reporte final: arquitectura, archivos modificados, mejoras de performance, deuda técnica restante, próximos pasos.

---

## Estimación

Cada fase = 1 turno grande (edge functions + migraciones + UI). Total: **5 turnos**.

## Decisiones técnicas

- **No reinventar**: todo pasa por `aiClient`, `invokeAi`, `logger`, `useAsync`, tokens de diseño existentes (`--line`, blue/slate/Outfit/Figtree).
- **AI**: Gemini 3 Flash Preview para insights masivos (barato/rápido), GPT-5.4 solo para reportes ejecutivos mensuales.
- **RLS**: cada tabla nueva con policy `user_id = auth.uid()` + GRANTS obligatorios (`authenticated` + `service_role`).
- **Datos reales únicamente**: si falta información, la UI dice explícitamente qué cargar y dónde. Sin datos ficticios.
- **Producción**: cada fase queda deployable y sin regresiones antes de pasar a la siguiente.

## Confirmación

¿Arranco directo con Fase 1 (Business Intelligence Engine + Health Score + Blind Spots estructurados)? Si querés cambiar el orden, priorizar algo específico, o dividir aún más las fases, decime antes de arrancar.
