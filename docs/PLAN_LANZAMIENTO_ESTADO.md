# Plan de lanzamiento — estado real y handoff

Auditoría del repo contra `Ferova-One-Plan-Lanzamiento.html` (8 fases). Este
documento consolida: qué YA estaba hecho, qué implementé en esta sesión, y qué
queda — separando lo que necesita **tu mano** (paneles, decisiones) de lo que
dejo **diseñado y listo para pegar** pero que NO debe aplicarse a ciegas en
producción (sin staging, con tus finanzas reales).

Regla que seguí: nada que pudiera romper datos o funciones se aplicó a ciegas.
Los commits quedan **locales, sin push** — tú revisas y subes (el push despliega
a producción vía Lovable).

---

## Resumen por fase

| Fase | Estado |
|---|---|
| 1 Seguridad / no filtrar | Código sustancialmente hecho. Falta panel: RLS FORCE + Advisor, Sentry (DSN), staging, backups. |
| 2 Organizaciones (multi-tenant) | **No iniciada.** Diseño abajo. La migración más grande y riesgosa: requiere staging. |
| 3 Recuperar módulos | Hecho, salvo pegar `APOLLO_API_KEY` (panel). Fix de caché aplicado. |
| 4 Costo por usuario | Instrumentación + p95 + enrutado listos. Falta ampliar cobertura de logging (abajo). |
| 5 Legal / cobrar | Términos + Privacidad + Reembolsos + Subencargados listos, con pasarela = **Paddle** (según el documento). El código actual tiene PayPal: hay que migrarlo a Paddle (Merchant of Record). Ver prompt para Lovable. |
| 6 Confianza | /seguridad + export integral listos. Borrado self-service y taint: diseñados abajo. |
| 7 Precio | Página + planes existen. Trial/fee/grandfathering = decisión tuya (borradores abajo). |
| 8 Vender | Changelog + evento de activación listos. Faltan E2E de pago y proceso de incidentes. |

---

## Hecho en esta sesión (commits locales, sin push)

1. **Fix de caché IA** (`business-assistant-chat`, `onboarding-chat`): variables
   (`nombre_negocio`, alcance de memoria, campos faltantes) movidas al final del
   prompt. El prefijo estático ahora es cacheable → lectura de caché al ~10% del
   costo de entrada.
2. **Analítica p95** de costo: migración `20260812190000_ai_usage_stats.sql`
   (función `admin_ai_usage_overview`) + edge function `admin-ai-usage`. Lee el
   `ai_usage_log` que ya se llenaba y expone p95 por usuario y por llamada,
   desglose por función y modelo. Solo `owner` accede.
3. **Páginas nuevas**: `/seguridad`, `/reembolsos`, `/subencargados`,
   `/novedades` (changelog), enlazadas desde el footer.
4. **Export integral autoservicio**: edge function `account-export` + botón en
   Configuración → "Descargar copia completa (JSON)". Incluye `audit_log`.
5. **Evento de activación**: `trackActivationOnce()` en analytics + cableado en el
   primer uso del asistente (`AISidebar`).

Verificado: `npx tsc --noEmit` sin errores.

---

## Necesita TU mano (panel / decisión) — no lo puedo hacer yo

- **`APOLLO_API_KEY`** en secretos de Supabase → recupera el módulo de ventas
  (apollo-enrich) entero. Es la acción de mayor retorno del plan.
- **Sentry**: crear cuenta, copiar el DSN → luego se cablea (código listo abajo).
- **Security Advisor** de Supabase: correr y dejar en cero.
- **Staging + backup verificado**: imprescindible ANTES de la Fase 2.
- **Decisiones de negocio**: trial 14 días con tarjeta (sí/no), absorber o no el
  ~5% de PayPal en el precio, grandfathering para founders, términos exactos de
  reembolso (dejé un borrador razonable, confírmalo con contador/abogado).
- **Contador**: tratamiento fiscal de exportación de servicios (IVA art. 481 c),
  RUT exportador, facturación electrónica.

---

## Diseñado, listo para pegar — NO aplicar a ciegas

### A. RLS FORCE (Fase 1) — tras staging

Sin `FORCE`, el dueño de la tabla ignora las políticas; migraciones y trabajos
programados corren como dueño. `service_role` (edge functions) **sigue** saltando
RLS porque tiene BYPASSRLS — FORCE no lo afecta. El riesgo son funciones
`SECURITY DEFINER` que asumen bypass: por eso se prueba en staging primero.

Migración a crear cuando exista staging (una línea por tabla de negocio):

```sql
-- 20260813_rls_force.sql  (NO commitear hasta probar en staging)
alter table public.finance_ventas          force row level security;
alter table public.finance_pagos_egresos   force row level security;
alter table public.planner_tasks           force row level security;
alter table public.ferova_knowledge        force row level security;
-- … repetir para cada tabla con datos de cliente.
```

Verificación: correr Security Advisor → cero. Probar con dos usuarios A/B que
ninguno vea datos del otro.

### B. Sentry (Fase 1) — cuando tengas el DSN

1. Añadir dependencia (en Lovable / bun): `@sentry/react`.
2. Crear `src/lib/observability.ts`:

```ts
import * as Sentry from '@sentry/react';

export function initObservability() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return; // sin DSN, no-op (dev y prod sin configurar)
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,
  });
}
```

3. En `src/main.tsx`, antes de `createRoot`: `initObservability();`
4. Poner `VITE_SENTRY_DSN` como variable de entorno (no hardcodear).
5. En Sentry: alerta por tasa de errores + uptime check (o UptimeRobot al dominio).

No lo dejé cableado en el repo para no desincronizar `bun.lock` ni meter un import
sin la dependencia (rompería `tsc`/build). Es pegar estos 4 pasos.

### C. Borrado de cuenta self-service (Fase 6) — versión segura con gracia

El borrado inmediato es irreversible y no lo puedo probar aquí. La versión
correcta y segura es una **solicitud con período de gracia** (reversible):

1. Migración: añadir a `business_profile` (o `user_subscriptions`):
   `deletion_requested_at timestamptz`, `deletion_scheduled_for timestamptz`.
2. UI en Configuración: "Eliminar mi cuenta" → confirmación fuerte → setea
   `requested_at = now()`, `scheduled_for = now() + interval '15 days'`. Botón para
   cancelar mientras esté en gracia.
3. Purga real (tras la gracia): reutilizar `admin-delete-customer` **añadiendo el
   borrado explícito de embeddings**:

```sql
delete from public.ferova_knowledge_embeddings
  where knowledge_id in (select id from public.ferova_knowledge where owner_user_id = :uid);
delete from public.ferova_knowledge where owner_user_id = :uid;
```

   Disparar la purga con un cron (Supabase Scheduled) que barra los
   `scheduled_for < now()`, o manualmente desde el panel admin.
4. Al purgar: **revocar tokens de terceros**. Hoy los tokens de Google no se
   persisten (solo viven en la sesión del navegador), así que no hay almacén que
   revocar — pero si algún día se guardan, llamar a `oauth2/revoke` de Google aquí.

### D. Taint / confirmación en `reviews-scan` (Fase 6)

`reviews-scan` lee correos (contenido NO confiable), se los pasa a la IA e
inserta en `crm_resenas` directo. Riesgo de prompt-injection desde el cuerpo del
correo. Mitigación:

1. Migración: `alter table public.crm_resenas add column origen text default 'manual';`
   y `add column requiere_confirmacion boolean default false;`
2. En `reviews-scan/index.ts`, al insertar lo derivado de correo, marcar
   `origen: 'ia_email'`, `requiere_confirmacion: true`.
3. En la UI de reseñas: las `requiere_confirmacion` se muestran como "pendiente de
   confirmar" y NO se propagan a métricas/acciones del negocio hasta que un humano
   las apruebe. Regla general: si el razonamiento pasó por contenido externo, la
   escritura material exige confirmación.

### E. Cobertura de logging de costo (Fase 4) — parcialmente hecho

Hecho en esta sesión:
- `_shared/ai-usage.ts` ahora lee también el formato crudo del gateway
  (`prompt_tokens`, `completion_tokens`, `total_tokens`,
  `prompt_tokens_details.cached_tokens`), además del del AI SDK.
- `planner-insights` (insights + briefing) ya llama `logAiUsage`.
- Cubiertos desde antes: `business-assistant-chat` y `onboarding-chat` (los
  únicos con gpt-5, el modelo caro).

Pendiente (bajo valor: todas usan gemini-flash barato, y es mecánico): instrumentar
`ceo-report-generate` y `decision-simulate` (la llamada IA vive en un helper sin
`admin`/`userId` — hay que pasarlos o devolver el `usage` y loguear en el handler);
`planner-classify` (hace hasta 20 llamadas por invocación — conviene agregar los
tokens y loguear una vez, no 20 filas); y `apollo-enrich`, `linkedin-analyze`,
`reviews-scan`, `sortlist-leads-scan`, `whatsapp-*`. Patrón: tras obtener el
`usage` de la respuesta, `logAiUsage(admin, { userId, funcion, modelo, usage })`.

### F. Cláusulas legales pendientes (Fase 7) — borradores para `Terminos.tsx`

Decisiones tuyas; texto sugerido:

- **Preaviso de cambio de precio**: "Podemos ajustar el precio de la suscripción
  avisando con al menos 30 días de anticipación por correo. El nuevo precio aplica
  desde el siguiente período de facturación."
- **Grandfathering founders (con caducidad)**: "Los suscriptores fundadores
  conservan su precio de lanzamiento por 12 meses desde su contratación; luego
  pasan al precio de lista vigente con el preaviso indicado." (El indefinido es
  deuda de precios que arrastras años.)
- **Uso justo**: "El uso del asistente de IA está sujeto a un uso razonable acorde
  a la operación de un negocio. Nos reservamos contactar y acordar condiciones con
  cuentas cuyo consumo se desvíe de forma extraordinaria." (Sin contador visible en
  la interfaz.)

---

## Fase 2 — modelo de organizaciones (diseño, NO aplicar sin staging)

Hoy el sistema es **mono-tenant por `user_id`** con un equipo interno compartido
(`crm_team_members`, allowlist por email). El cerebro global (`owner_user_id NULL`)
lo comparten todos los del equipo. Funciona porque solo está tu equipo; el día que
entre un cliente-empresa con varios usuarios, se verían entre sí.

**Por qué se encarece esperando**: cada tabla nueva es una tabla más que migrar.

**Es bloqueante para vender?** No para los primeros clientes si son de un solo
usuario (cada uno ya está aislado por `user_id`). Se vuelve necesario cuando un
cliente tenga varios colaboradores compartiendo datos. Decisión tuya sobre cuándo.

Diseño propuesto (probar en staging, con backup verificado inmediatamente antes):

```sql
-- 1. Tablas de organización
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  created_at timestamptz not null default now()
);
create table public.organization_members (
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null,
  rol text not null default 'colaborador',  -- owner | admin | colaborador
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);
-- Un usuario puede pertenecer a varias organizaciones (multi-org).

-- 2. Organización activa por usuario (desde cuál "pregunta")
create table public.user_active_org (
  user_id uuid primary key,
  org_id uuid not null references public.organizations(id)
);

-- 3. Helper: la org activa del que consulta
create or replace function public.current_org_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select org_id from public.user_active_org where user_id = auth.uid()
$$;

-- 4. org_id en ferova_knowledge y en TODAS las tablas de negocio.
--    Ojo: el cerebro privado TAMBIÉN necesita org_id (si no, tus notas privadas
--    de Ferova aparecen mientras trabajas dentro de la cuenta de un cliente).
alter table public.ferova_knowledge add column org_id uuid;
-- … alter add column org_id en finance_*, crm_*, planner_*, etc.

-- 5. Reescribir RLS: política RESTRICTIVE de organización (se combina con AND;
--    actúa de red de seguridad aunque después se añada una política muy abierta).
--    Ej. por tabla:
create policy org_isolation on public.finance_ventas
  as restrictive for all
  using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());

-- 6. match_ferova_knowledge: añadir filtro por org_id (hoy solo filtra match_user).
--    where k.org_id = current_org_id() and (k.owner_user_id is null or = match_user)
```

**Pruebas pgTAP de aislamiento (la prueba de mayor retorno del plan)**: un caso por
tabla × por rol × lectura ajena / escritura ajena, en CI. Media jornada, y es la
única forma de que una migración futura no rompa el aislamiento en silencio.

**Migración de tus datos actuales** a una organización "Ferova": guion probado antes
en staging, con respaldo verificado inmediatamente antes.

---

## Lo que el plan dice NO hacer todavía (correcto)

SOC 2 / ISO 27001, apps iOS/Android, app de escritorio, SLA contractual, búsqueda
híbrida/reranking, panel de soporte entre organizaciones, página de estado,
rediseño visual. Todo vale más con 10 clientes que con cero.
