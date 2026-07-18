# Ferova OS — Architecture

## Contexto

SPA React/Vite/TypeScript sobre Lovable Cloud/Supabase. El navegador usa Supabase Auth y Postgres con RLS. Las Edge Functions concentran operaciones privilegiadas, IA e integraciones externas.

```text
React/Vite browser
  ├─ Lovable Auth + Supabase client
  ├─ Supabase Postgres + RLS
  ├─ Edge Functions → IA, Google, PayPal, WhatsApp, Apollo, LinkedIn, Reddit, TRM
  └─ Google Sheets/Drive opcional
```

## Frontend

- Entrada: `src/main.tsx`; router: `src/router.tsx`; boundary: `ErrorBoundary`.
- Estilo: Tailwind y CSS del proyecto.
- Estado: React local; no existe store global.

| Ruta | Entrada | Protección |
|---|---|---|
| `/` | `App.tsx` | Auth, acceso y plan dentro del shell |
| `/admin/*` | `routes/AdminRoute.tsx` | Solo equipo Ferova |
| `/maintenance` | `MaintenancePage` | Variable de entorno |
| `*` | `NotFound` | 404 |

El root usa `activeTab`; los módulos aún no tienen rutas/deep links individuales.

## Ciclo de aplicación

1. `initAuth` obtiene sesión.
2. `resolveAccess` e `isTeamMember` resuelven plan y rol.
3. Se cargan finanzas, perfil y conexión Google.
4. Se ejecuta onboarding cuando corresponde.
5. `App.tsx` compone navegación y módulo activo.
6. Los servicios persisten; la UI conserva estado local.

## Servicios

| Servicio | Responsabilidad |
|---|---|
| `financeService` | Entidades financieras y TRM |
| `crmService` | CRM interno e integraciones Growth |
| `bizCrmService` | CRM de cliente |
| `plannerService` | Planner y funciones IA |
| `biService` | Health y blind spots |
| `reportsService` | Reportes y simulaciones |
| `businessProfileService` | Perfil/onboarding |
| `adminService` | Administración interna |
| `sheetsService` | Google Sheets/Drive |
| `ai/aiClient` | Cliente IA de navegador |

## Project core

Projects are the delivery boundary for the existing system. The current schema stores project tracking on a client record, so `src/domains/projects` exposes a derived `Project` aggregate rather than introducing a duplicate table. It joins the project client with its related services, sales and hours, while preserving the existing persistence contract.

```text
Project (client delivery context)
  ├─ Clients: owner and project metadata
  ├─ Services: services delivered to the client
  ├─ Finance: sales and their financial impact
  ├─ Hours: delivery capacity and effort
  ├─ CRM: commercial relationship around the client
  ├─ Planner/AI: future consumers of the same project context
  └─ Objectives, KPIs and deliverables
```

`projectService` owns aggregate construction and project metadata updates. `useProjectPortfolio` is the UI-facing read hook. A future dedicated projects table must migrate this aggregate behind the same service boundary instead of coupling UI directly to a schema change.

## Reglas

1. Componentes no contienen secretos ni llaman servicios privilegiados de terceros.
2. Persistencia de dominio pasa por servicios, no por acceso arbitrario desde componentes.
3. Cada cambio de esquema requiere migración, RLS y revisión de políticas.
4. Toda integración nueva usa Edge Function salvo API de navegador explícitamente autorizada.
5. Todo módulo nuevo define datos, servicio, autorización, plan y ruta antes de implementarse.

## Restricciones actuales

`App.tsx` concentra shell/carga/gating; `AdminCRM.tsx` y varios CRUD son grandes; se carga un dataset financiero amplio; `sheetsService.ts` reúne demasiadas responsabilidades.
