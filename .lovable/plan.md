# Diagnóstico Ferova One — plan por fases (P0/P1/P2)

Inspección hecha sobre el repo actual. No se cambió nada. Nada de lo propuesto elimina módulos ni reescribe la app: son ajustes acotados sobre lo que ya existe.

## Lo que está bien y se preserva

- **Shell y navegación v2** (`src/components/layout/AppShell.tsx`, `PrimaryNavigation`, `ContextNavigation`): jerarquía sección → sub-tab con breadcrumb, sidebar colapsable y menú móvil. Base sólida, no tocar la estructura.
- **Entitlements** (`src/lib/planService.ts` + overrides admin): resuelve módulos visibles de forma limpia y testeada (`tests/planService.test.ts`).
- **Idempotencia Planner → Horas**: verificada en base de datos. `finance_horas` tiene PK compuesta `(user_id, id)` y `plannerService.completeTask` hace `upsert` con `id = planner_<taskId>` y `onConflict: 'user_id,id'`. Completar dos veces no duplica. **No rehacer esta lógica.**
- **Clasificación NLP** (`supabase/functions/planner-classify`): ya resuelve `detected_client` contra `finance_clientes` reales (match exacto + parcial), estima duración con histórico por cliente y detecta deadline ISO. La base del lenguaje natural existe.
- **Capa de datos**: servicios por dominio (`financeService`, `plannerService`, `crmService`…), migraciones versionadas, RLS por `user_id`. Buen patrón, seguir usándolo.

## P0 — Bugs y regresiones

### 1. Horas del Planner se registran con fecha equivocada
`completeTask` escribe `fecha: new Date().toISOString().slice(0,10)` (día de cierre), no el día en que la tarea estaba programada. Una tarea del lunes cerrada el miércoles cae en el miércoles y descuadra rentabilidad por período.
Aceptación: al completar una tarea con `scheduled_for` pasado, el registro en Horas usa `scheduled_for`; sin `scheduled_for` usa el día actual.

### 2. Tareas sin servicio nunca llegan a Horas
El registro exige `client_ref` **y** `service_ref`. Como el clasificador detecta cliente pero no servicio, en la práctica casi ninguna tarea genera horas y el usuario percibe que "el cronómetro no sirve".
Aceptación: con cliente y sin servicio, la tarea igual registra la hora usando el servicio por defecto del cliente si existe; si no, se guarda con `servicio_id` nulo y aparece marcada como "sin servicio" en Horas, con acción de asignarlo en un clic.

### 3. Pantallas oscuras heredadas
17 archivos aún usan hex crudos oscuros. Los de mayor superficie: `GastosAdmin.tsx` (752), `VentasAdmin.tsx` (979), `PagosEgresosAdmin.tsx` (531), `ClientesAdmin.tsx` (396), `ServiciosAdmin.tsx` (444), `ConfigAdmin.tsx` (588), más `ImpuestosIva`, `AlertasTributarias`, `EquilibrioGlobal`, `EquilibrioServicio`, `OperatingKpiDashboard`, `Paywall`, `ui/MetricTooltip`, `ui/InlineDeleteConfirm`.
Aceptación: cero `bg-[#…]`/`text-[#…]` oscuros en esos archivos; todo pasa por tokens del tema claro; contraste AA verificado en texto secundario y badges.

### 4. Hex hardcodeados también en el shell v2
`AppShell.tsx` mezcla variables (`var(--ferova-*)`) con literales (`#1f1b16`, `#57524a`, `#a39a8a`). Impide tematizar y produce derivas de color entre módulos.
Aceptación: el shell usa solo variables CSS del design system.

## P1 — UX funcional

### 5. Proyectos vs. Seguimiento: separación incorrecta
Hoy son dos tabs distintos que apuntan a componentes sin relación (`ProyectosAdmin` = objetivos/hitos/KPIs; `seguimiento` = `OperatingKpiDashboard`, KPIs operativos globales del negocio). El usuario espera ver el seguimiento *del proyecto/cliente que está mirando*.
Propuesta: **Proyectos** pasa a ser un único tab con selector de cliente persistente y dos vistas internas (Plan / Seguimiento) filtradas por ese cliente. `OperatingKpiDashboard` no se elimina: se mueve a Finanzas → "KPIs operativos" (ya es una vista de negocio, no de proyecto).
Aceptación: cambiar de cliente conserva la vista; el seguimiento muestra solo datos del cliente activo; ningún KPI existente desaparece de la app.

### 6. Planner: iniciar/terminar y duración real poco visibles
`startTask`/`completeTask` existen y calculan `elapsedMinutes`, pero no hay lectura clara del tiempo corriendo ni de la diferencia estimado vs. real.
Aceptación: la tarea en curso muestra cronómetro vivo; al terminar se ve "estimado X min · real Y min" y el enlace al registro de Horas creado.

### 7. Captura en lenguaje natural: confirmación antes de guardar
El clasificador acierta cliente y fecha pero el usuario no ve ni corrige lo detectado antes de que la tarea quede creada.
Aceptación: tras escribir la línea aparece un chip editable con cliente, fecha y duración detectados; se puede corregir en el momento y la corrección se guarda.

### 8. Servicios/cobros con IVA
`aplica_iva` ya está en tipos y persistencia. Falta que la lectura sea inequívoca en catálogo y en la venta.
Aceptación: cada servicio muestra "IVA incluido / no incluido" y el precio con y sin IVA; el cálculo de la venta respeta la bandera.

## P2 — Mejoras

- Dividir `AdminCRM.tsx` (2.524 líneas) y `App.tsx` (962) en piezas por responsabilidad, sin cambiar comportamiento.
- Unificar el uso de `formatCop`/`formatUsd` y de estados de carga (`AsyncState`) en los módulos que aún los implementan a mano.
- Home: reducir a 5 KPIs máximo y que cada tarjeta navegue a su módulo.
- Búsqueda global (Command Palette) alcanzando clientes, proyectos y tareas.

## Notas técnicas y riesgo de regresión

- **Migraciones**: nada de lo anterior exige alterar tablas de forma destructiva. Lo único posiblemente nuevo es hacer `servicio_id` opcional en el registro proveniente de Planner (punto 2) — verificar si la columna ya es nullable antes de tocar el esquema; si no lo es, migración aditiva `ALTER COLUMN … DROP NOT NULL`.
- **Riesgo mayor**: la reorganización de Proyectos/Seguimiento (punto 5) cambia rutas de tabs. Mitigación: mantener el id `seguimiento` como alias que redirige al nuevo destino, para no romper enlaces guardados ni el Command Palette.
- **Riesgo medio**: el barrido de paleta toca muchos archivos grandes. Mitigación: hacerlo módulo por módulo, un commit por archivo, revisión visual antes de pasar al siguiente.
- **Riesgo bajo**: cambios de Planner son localizados en `plannerService.ts` + `SmartPlanner.tsx` y están cubiertos por la PK compuesta que garantiza idempotencia.

## Archivos probables a revisar

```text
src/App.tsx                              (switch de tabs, líneas ~486-560 y ~700-760)
src/components/layout/AppShell.tsx       (hex → tokens)
src/components/ProyectosAdmin.tsx        (unificación + selector de cliente)
src/components/OperatingKpiDashboard.tsx (reubicación a Finanzas)
src/components/SmartPlanner.tsx          (cronómetro, chips NLP)
src/lib/plannerService.ts                (completeTask: fecha y servicio)
supabase/functions/planner-classify/     (devolver servicio sugerido)
src/components/{Gastos,Ventas,PagosEgresos,Clientes,Servicios,Config}Admin.tsx  (paleta)
src/components/ui/{MetricTooltip,InlineDeleteConfirm}.tsx                        (paleta)
```

## Orden sugerido

P0.1 + P0.2 (una tanda, mismo archivo) → P0.3 + P0.4 (paleta, por módulo) → P1.5 → P1.6 + P1.7 → P1.8 → P2.

## Pregunta bloqueante (una sola)

En el punto 5, ¿confirmás que `OperatingKpiDashboard` (KPIs operativos del negocio) se mueve a **Finanzas** en lugar de quedarse bajo Proyectos? Es la única decisión que cambia la estructura de navegación y prefiero no asumirla.
