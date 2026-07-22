# Ferova One — Catálogo de métricas financieras y operativas

> Fuente: `Manual de implementación de Ferova One para freelancers, consultores y agencias`. Este documento **es** el "siguiente movimiento" que pide el manual: *"Antes de escribir código nuevo, el equipo debe crear una tabla con todos los indicadores que actualmente aparecen en Ferova One... Ese inventario será el contrato para mejorar la lógica sin dañar lo que ya funciona."*
>
> Construido leyendo el código real (no el manual), en Fase 0/1 estrictas: **cero cambios de comportamiento** salvo uno, señalado explícitamente abajo. Complementa [DESIGN_SYSTEM_V2.md](./DESIGN_SYSTEM_V2.md) y [SEO_LANDING_BLOG.md](./SEO_LANDING_BLOG.md).

## Cómo leer este documento

Cada métrica sigue el esquema que el propio manual propone en su sección 25 (`code`, `public_name`, `simple_definition`, `formal_formula`, `inputs`, `module`, `edge_cases`, `notes`). Los `code` son identificadores que invento yo para este catálogo (no existen todavía en la base de datos) — sirven como vocabulario común, no como algo ya implementado.

---

## Hallazgos críticos (leer esto primero)

### 1. Hay 4 implementaciones independientes de "ingresos / costo directo / margen"

No una fórmula centralizada reusada en cuatro lugares — **cuatro cálculos distintos**, cada uno con su propia noción de qué significa "ingreso":

| Implementación | Base de reconocimiento | Dónde |
|---|---|---|
| `calcularMétricasFinancieras` | Ventas **contratadas** (`precio × cantidad`, sin importar si se cobró) | `src/lib/calculations.ts` |
| `buildCashflow` | Efectivo **realmente cobrado** (pagos confirmados, abonos) | `src/lib/cashflowService.ts` |
| `getServiceStats` | Ingreso real por servicio con **COGS histórico** (costo congelado al momento de cada venta) | `src/components/ServiciosAdmin.tsx` |
| Reporte CEO | Reimplementación propia en Deno, no puede importar `src/lib/*` | `supabase/functions/ceo-report-generate/index.ts` |

Esto **no es necesariamente un error** — el manual mismo (sección 6) pide distinguir ingresos contratados / causados / cobrados como conceptos separados. El problema real es que hoy son **cuatro código-fuente distintos que alguien tiene que mantener sincronizados a mano** en vez de una sola fuente de verdad con distintas proyecciones. Es el hallazgo más importante para cualquier trabajo futuro de "Fase 2: motor financiero central" — antes de centralizar, hay que decidir explícitamente cuál de los cuatro modelos es la fuente de verdad para cada pantalla.

### 2. Un "casi bug" investigado y descartado — documentado para que nadie lo "arregle" por error

`VentasAdmin.tsx` calcula la retención en la fuente **dos veces**: una vez en la vista previa del formulario (usa el cliente *actualmente seleccionado*) y otra vez en el historial (`calculateLoopRetention`, usa `venta.tipo`, un campo **congelado en la venta al momento de crearla**). A primera vista parece una duplicación descuidada. **No lo es**: `Venta.tipo` existe deliberadamente en el tipo (`src/types.ts`) como snapshot histórico, igual que `costo_unitario` ya está congelado por venta (documentado en `ServiciosAdmin.tsx`). Si una venta vieja se recalculara con el tipo *actual* del cliente en vez del tipo que tenía cuando se facturó, cambiaría retenciones ya declaradas ante la DIAN. **Se dejó exactamente como está.** Cualquier intento de "unificar" estas dos funciones debe preservar esta distinción live-vs-congelado, no colapsarla.

### 3. Un ajuste sí se aplicó — cero riesgo, corrige una inconsistencia real

`ImpuestosIva.tsx` tenía el umbral de responsable de IVA hardcodeado como literal `3500`, en vez de leer `config.tope_responsable_iva_uvt` (que existe, y cuyo valor por defecto es exactamente `3500`) — tal como sí hace correctamente `AlertasTributarias.tsx`. Corregido para leer el config. **Esto no cambia ningún número que un usuario esté viendo hoy** (el valor por defecto es idéntico), pero corrige el *drift* real: si alguien edita ese campo de configuración, antes solo una de las dos pantallas se enteraba.

### 4. ~16 constantes de negocio (umbrales, tasas) sin respaldo en `Config` ni en ninguna tabla

Ver la lista completa en la sección final. Ninguna se tocó — son candidatas para una futura tabla `tax_rules`/`business_thresholds` parametrizada (manual, sección 17), no bugs a corregir ahora.

---

## Catálogo por módulo

### `src/lib/calculations.ts` — el motor central (ya centralizado)

| code | public_name | formula | notas |
|---|---|---|---|
| `PRESTACIONES_SOCIALES` | Prestaciones sociales (independiente) | `ibc = max(salario × 0.40, smmlv)`; `salud = ibc × 0.125`; `pension = ibc × 0.16` | Solo Colombia (`isColombiaFiscal`); otros países devuelven ceros con `applies: false` |
| `TOOLS_COST_ALLOCATION` | Costo de herramientas SaaS | Global o `× clientesActivos` según `tipo_cobro`; prorrateo entre servicios vinculados | — |
| `FINANCIAL_METRICS` (`calcularMétricasFinancieras`) | Utilidad bruta/operacional/neta, punto de equilibrio, margen de contribución | Ver `src/lib/calculations.ts:149-273` | **La fuente de verdad para Dashboard, EquilibrioGlobal, ImpuestosIva, AlertasTributarias.** Base de reconocimiento: ventas *contratadas*, no cobradas. |
| `CLIENT_PRODUCTIVITY` | Rentabilidad por cliente (GANANCIA/EQUILIBRIO/PÉRDIDA) | `valorHora = ingresos/horas`; umbral de pérdida en `HorasAdmin.tsx`, no aquí | — |
| `SERVICE_PRODUCTIVITY` | Productividad por servicio | Horas y valor/hora agregados por servicio | No incluye margen (ver `ServiciosAdmin.tsx` para eso) |

### `src/lib/pricingIdeal.ts` — precio ideal recomendado

`precioIdeal = (costoUnitario + overhead) / (1 − margenObjetivo)`. Ya implementa exactamente el "Nivel 3: ver cómo se calculó" del manual — expone `formulaHumana` y `notas` legibles. Nunca sobreescribe `precio_habitual`/`precio_ofrecido`, solo sugiere.

### `src/components/EquilibrioServicio.tsx` — equilibrio por línea de servicio

- **Herramientas asignadas / Carga estructural por servicio**: overhead del socio se reparte **en partes iguales** entre servicios (`salario_propuesto / servicios.length`) — el propio código lo marca como `// simple base`. No pondera por ingresos ni horas como pide el manual (sección 11.3). Candidato de mejora explícito, no urgente.
- **Precio de venta de referencia**: si no hay historial de ventas, usa un **valor hardcodeado de 3.500.000 COP** como fallback (línea ~74). Constante de negocio sin respaldo en `Config`.
- **Margen de contribución unitario / Unidades de equilibrio**: si el margen es ≤0 (vendiendo a pérdida), el código hace fallback silencioso a "1 unidad para equilibrio" en vez de señalar que el equilibrio es matemáticamente imposible con ese precio. **Esto puede mostrar un mensaje engañosamente optimista** — vale la pena revisar el copy, no la fórmula.

### `src/components/HorasAdmin.tsx` — control de horas

- **Hora Cobrada Promedio** / **Valor Hora Real**: `totalVentas / horas` y `utilidadNeta / horas`.
- **Hora Mínima Objetivo**: `salario_propuesto / (horas_objetivo_mes || 160)` — es, en la práctica, el único lugar de toda la app donde vive el concepto de "tarifa horaria mínima aceptable", pero **calculado de forma independiente**, no vía una función compartida — el equivalente mental de `pricingIdeal.ts` pero sin el mismo tratamiento.
- **Umbral de "PÉRDIDA" por cliente**: `horaObjetivoMinima × 0.75` — constante `0.75` hardcodeada, sin campo en `Config`.

### `src/lib/cashflowService.ts` + `debtsService.ts` + `receivablesService.ts` + `payablesService.ts` — flujo de caja (base de caja real)

Ya implementa la separación caja actual / comprometida / proyectada que pide la sección 12 del manual, aunque de forma más simple (sin ponderación probabilística por antigüedad de factura, sección 12 "Cobros ponderados" — hoy es binario: pagado o no).

- **Ingresos/gastos reales**: compatibilidad hacia atrás explícita entre el modelo nuevo de pagos (`abonos`) y el legacy (`adelanto`) — comentado en el código.
- **`pagos_tc_estimados` está muerto**: la fórmula se multiplica por un literal `0`, siempre da cero, y ni siquiera se muestra en la UI. Candidato de limpieza (implementar o eliminar), cero riesgo, cero usuarios afectados hoy.
- **Alerta de desviación de presupuesto**: umbral `20%` hardcodeado.
- **Alertas de vencimiento**: ventana de `5 días` hardcodeada.
- **`Debt.tasa`** (tasa de interés) se captura pero **nunca se usa** en ningún cálculo — es metadata informativa únicamente, no hay amortización.
- **`budgetService.ts`**: el texto de la UI dice "usando el *promedio* como punto de partida" pero el código sube el **total histórico acumulado**, no un promedio. Discrepancia copy-vs-código, no una fórmula rota.

### `src/components/ImpuestosIva.tsx` + `AlertasTributarias.tsx` — IVA y alertas DIAN

- **Proyección de ingresos anualizados** (`avgMonthlySales × 12`): el mismo bloque de código está **duplicado literalmente** en ambos archivos en vez de vivir en `calculations.ts`. Candidato de centralización de bajo riesgo (misma fórmula, sin ambigüedad de cuál es la "correcta").
- **Tres topes DIAN** (`tope_no_declarante_uvt`, `tope_responsable_iva_uvt`, `tope_no_paga_renta_uvt`) ya viven en `Config` — bien parametrizados. `AlertasTributarias.tsx` los usa correctamente; `ImpuestosIva.tsx` tenía uno hardcodeado (ver hallazgo #3 arriba, ya corregido).
- **Semáforo de alertas**: `< 70%` seguro, `< 100%` preventivo, resto "obligación superada" — umbrales hardcodeados, sin campo en `Config`.
- **`Config` es un singleton plano, no una tabla `tax_rules` versionada**: los cálculos siempre usan los valores *de hoy*, nunca "los valores vigentes cuando se registró esta venta". Esto es exactamente la brecha que la sección 17 del manual quiere cerrar con una tabla `tax_rules` versionada por año/país — hoy no existe, y crearla implica una migración de base de datos que este documento **no** implementa (ver "Qué sigue" abajo).

### `src/components/VentasAdmin.tsx` — registro de ingresos

- **Retención en la fuente**: calculada en dos lugares con semántica distinta a propósito (ver hallazgo #2 arriba) — **no tocar sin entender la distinción live-vs-congelado**.
- **Estado de pago** (`Pagado`/`Adelanto`/`Pendiente`): la misma lógica de tres líneas se repite en crear, editar y mostrar. Duplicación de bajo riesgo, no urgente.

### `src/components/ClientesAdmin.tsx`

**Riesgo real encontrado**: los totales por cliente **no convierten moneda** — si un cliente tiene ventas mezcladas en COP y USD, se suman directamente y se etiquetan según cuál moneda predomine. Un cliente con ventas mixtas puede mostrar un total que mezcla pesos y dólares sin conversión. A diferencia de casi todo el resto de la app (que usa `convertToCop` consistentemente), este archivo no lo hace. **Vale la pena revisar si existen clientes así en producción antes de decidir si esto es un problema real o teórico.**

### `src/components/ServiciosAdmin.tsx` — margen real por servicio

Calcula margen bruto usando el **costo congelado al momento de cada venta** (`venta.costo_unitario`), no el costo actual del catálogo — diseño explícitamente documentado en el propio código como deliberado. Es la implementación de margen-por-servicio más "correcta" de las cuatro mencionadas en el hallazgo #1, pero vive sola en este archivo, no en `calculations.ts`.

### `src/lib/roiCalc.ts` + `MarketingROI.tsx` — ROI de marketing

El archivo mejor guardado del catálogo: **toda división pasa por `safeDiv`** (devuelve `0` en vez de `Infinity`/`NaN`), con un comentario explícito al inicio del archivo declarándolo como regla de diseño. La calculadora inversa (`reverseRoi`) es exactamente la que el manual pide conservar (sección 15) — meta de facturación → ventas/citas/leads/clics/impresiones necesarios, con tasas históricas propias o defaults genéricos (`ctr: 2%`, `cpc: 800`, etc.) cuando no hay historial.

### `src/components/AdminCRM.tsx` — CRM interno

Margen de oportunidad y clasificación Hot/Warm/Cold (`≥70` / `≥40` de probabilidad) — probabilidad viene de un scoring externo por IA (Apollo/LinkedIn), no calculado aquí. Umbrales hardcodeados, consistentes con el resto del catálogo.

### Edge Functions (fuera de `src/`, calculan del lado del servidor)

- **`ceo-report-generate`**: cuarta reimplementación de ingresos/costo/margen (ver hallazgo #1). El `health_score` que muestra **no se calcula ahí** — se lee de una tabla `business_health_snapshots`, cuya fórmula real vive en otro lugar no revisado en esta pasada (hilo abierto).
- **`decision-simulate`**: simulador "qué pasaría si" (contratar / cambiar precio / invertir / recortar / promoción) — determinista, con una elasticidad de demanda por defecto de `-1` y una ventana "mensual" que en realidad son 30 días fijos, no un mes calendario real.

### Sin lógica de cálculo (confirmado, información negativa útil)

`financeService.ts` (solo CRUD + constantes por defecto), `FinancialStatement.tsx`/`financialStatement.ts` (solo reformatea `calcularMétricasFinancieras`), `PlanOnboarding.tsx`/`businessProfileService.ts` (**el onboarding de hoy solo recolecta datos — no calcula ninguna tarifa mínima sugerida**, a diferencia de lo que propone la sección 5 del manual), `crmService.ts`/`bizCrmService.ts`/`CustomerCRM.tsx` (CRUD + proxies a IA externa), `ReportsView.tsx`/`reportsService.ts` (proxy puro a edge functions).

---

## Constantes de negocio sin respaldo en `Config` (candidatas a parametrizar)

Ninguna se tocó. Lista para cuando se aborde la sección 17 del manual (tabla `tax_rules`):

1. Todo `DEFAULT_CONFIG` en `financeService.ts` — constantes DIAN de un año específico, hardcodeadas como semilla inicial (después editables por usuario, pero el *default* no está versionado por año).
2. `EquilibrioServicio.tsx` — fallback de 3.500.000 COP cuando un servicio no tiene ventas.
3. `HorasAdmin.tsx` — umbral `× 0.75` para clasificar un cliente como "PÉRDIDA".
4. `AlertasTributarias.tsx` — bandas `70%` / `100%` del semáforo tributario.
5. `PagosEgresosAdmin.tsx` — "gasto alto" en `≥2.000.000 COP` / `≥500 USD`.
6. `cashflowService.ts` — desviación de presupuesto `>20%`; ventana de vencimiento de `5 días`.
7. `ServiciosAdmin.tsx` — "buen margen" en `≥50%`.
8. `AdminCRM.tsx` — bandas de margen `50%`/`20%`; niveles Hot/Warm/Cold en `70`/`40` de probabilidad.
9. `MarketingROI.tsx` — tasas de conversión por defecto cuando no hay campañas históricas (`ctr: 2%`, `cpc: 800`, etc.).
10. `roiCalc.ts` — supuesto `clics = leads` (1:1) en la calculadora inversa.
11. `decision-simulate` (edge function) — elasticidad de demanda por defecto `-1`; ventana "mensual" de 30 días fijos.
12. `cashflowService.ts` — `pagos_tc_estimados` multiplicado por `0` (código muerto, no una constante real, pero afecta una cifra financiera mostrada como si fuera calculada).

---

## Fase 2 — Motor centralizado (avance parcial, sesión posterior)

Se agregó `src/lib/engine/financialEngine.ts` con las funciones de A.2 que tienen fórmula exacta y sin ambigüedad en la Parte 4 del manual: `calculateHealthyHourlyRate` (4.3, validado contra el ejemplo literal del manual: 40h/semana, 60% facturable, 5.000.000/2.000.000 → ~81.000 COP/hora), `calculateHourlyCost`, `calculateServiceProfitability`/`calculateClientProfitability` (4.5, con semáforo de margen), `calculateCapacity` y `calculateBreakEven` (4.6). Pruebas en `tests/financialEngine.test.ts` (`npm test`).

**Deliberadamente construido en paralelo, no integrado a ninguna pantalla todavía.** Integrarlo a Dashboard/EquilibrioGlobal/HorasAdmin requiere primero la decisión explícita que este catálogo ya identificó como bloqueante (hallazgo #1: reconciliar cuál de las 4 nociones de "ingreso" alimenta cada función) — hacerlo sin esa decisión duplicaría, no centralizaría, la lógica.

**No incluido en esta pasada** (necesitan tablas nuevas en producción o decisiones de modelo de datos que no me corresponden a mí decidir): `calculateCashPosition`/`calculateCashForecast` (necesitan probabilidad de cobro ponderada por antigüedad, sección 4.7 — hoy `cashflowService.ts` es binario pagado/no pagado), `calculatePipelineForecast` (necesita etapas de pipeline con probabilidad, sección 4.8), `calculateTaxProvision` (necesita la tabla `tax_rules` versionada de la sección 4.10/17, que no existe), `reconcileTransactions` (necesita arquitectura de 4 capas raw/canonical/metrics/audit, sección 4.15).

También se aplicaron, de la lista "candidatas cero riesgo" de este mismo catálogo: se eliminó `pagos_tc_estimados` (multiplicaba por `0` literal, nunca se mostraba en UI, sin datos reales para calcularlo de verdad -- ver hallazgo original arriba) y se centralizó la fórmula de proyección de ingresos anualizados duplicada en `ImpuestosIva.tsx`/`AlertasTributarias.tsx` hacia `calcularProyeccionAnualIngresos()` en `calculations.ts`.

## Qué sigue (no implementado en esta pasada, a propósito)

Todo lo demás del manual — tabla `tax_rules` versionada, arquitectura de 4 capas (raw/canonical/metrics/insights), separación completa de ingresos contratados/causados/cobrados con probabilidad de cobro ponderada, motor de capacidad operativa, centralización del embudo de CRM, sistema de memoria/aprendizaje de la IA, motor de reconciliación, rediseño del onboarding con tarifa mínima sugerida — son cada uno un proyecto real de varios días, y la mayoría requieren tablas nuevas en la base de datos de producción (Lovable Cloud), a la que no tengo acceso de escritura directo en esta sesión (ver `docs/SEO_LANDING_BLOG.md` y memoria del proyecto para el mismo hallazgo en otro contexto).

**No se tocan sin que tú decidas prioridad**, exactamente como pide la sección 3 del manual ("qué no se debe cambiar") y como confirma este mismo catálogo: la lógica actual está más centralizada y mejor protegida contra `/0` de lo que el manual asumía como peor caso — el riesgo real no es que todo esté roto, es que hay **cuatro definiciones de "ingreso" que hay que reconciliar a propósito**, no por accidente, antes de construir nada nuevo encima.
