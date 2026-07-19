# Fase 1 — Fundaciones de calidad

## Entregado

### Pruebas de cálculos críticos
- `tests/calculations.test.ts` — cubre `convertToCop`, `calcularPrestaciones` (CO + fuera de CO + piso SMMLV), `calcularCostosHerramientas` (global vs porCliente, distribución entre servicios), `getUniqueSalesMonths`, `calcularMétricasFinancieras` (mes vs "Todos", conversión USD→COP, escala de meses activos, corte fiscal fuera de CO con `impuestoRentaEstimado=0`), `calcularProductividadClientes` y `calcularProductividadServicios`.
- `tests/pricingIdeal.test.ts` — fórmula base, fallback a `costo_unitario`, margen inválido (negativo/≥1) usa 30 % default, overhead negativo se clampa, deltas `vsHabitual`/`vsOfrecido`.
- `tests/roiCalc.test.ts` — verifica que ningún denominador en 0 produzca `Infinity`/`NaN`, caso feliz con todas las tasas y costos totales, `reverseRoi` con y sin ticket promedio.
- `tests/planService.test.ts` — ya existía; queda dentro del script agregado.
- Script npm actualizado: `npm test` corre las 4 suites secuencialmente. Todas pasan.

### Primitives de estado async
- `src/components/ui/AsyncState.tsx` expone `<LoadingState/>`, `<ErrorState/>` y `<EmptyState/>` con soporte de `role="status"`/`role="alert"`, spinner accesible, botón de reintento y `normalizeError()` para uniformar mensajes (string, `Error`, respuesta Supabase, `error_description`). Todavía no se adoptó en cada componente — eso entra como higiene continua en Fase 3 al descomponer AdminCRM.

### Reducción de `any` en límites de servicios
- Nuevo helper `src/lib/db.ts`: cast único a Supabase con builders estructurales tipados (`select/insert/update/delete/upsert` + operadores de filtro). Elimina `(supabase as any).from(...)` y mantiene `data`/`error` tipados por tabla.
- Migrados a `db<T>()` sin `any`: `src/lib/plansService.ts` (`SaasPlan`), `src/lib/accountsService.ts` (`FinanceAccount`).
- Los servicios restantes (`crmService`, `financeService`, `sheetsService`, `receivablesService`, `debtsService`, `payablesService`, `marketingService`, `biService`, `budgetService`, `paymentMethodsService`, `reportsService`, `userEngagementService`) siguen con el patrón antiguo. La migración es mecánica ahora que `db.ts` existe; se hará en Fase 3 al reorganizar por feature.

### Package manager y lockfile
- Auditado: solo `package-lock.json` existe (no hay `bun.lockb`, `pnpm-lock.yaml`, `yarn.lock`). Ya está unificado en npm; no requirió acción.

## Verificación
- `npm test` → 4/4 suites ok.
- `npx tsgo --noEmit` → sin errores.
- Preview compila (Vite HMR sin cambios en shell).

## Pendiente / debate abierto
- **Observabilidad de Edge Functions / IA**: el punto del roadmap "observabilidad de funciones/IA" requiere decidir dónde emitir métricas (¿tabla `ai_events`? ¿solo logs?). No se hizo cambio de esquema (regla del usuario). Se retoma en Fase 4 cuando toque medir latencia/costo.
- Adopción masiva de `AsyncState` y migración del resto de servicios a `db.ts` se difiere a Fase 3 para no tocar 20+ archivos ahora.

Siguiente: **Fase 2** — extraer auth/bootstrap financiero/navegación de `App.tsx`, rutas lazy con guards.
