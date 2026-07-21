# Ferova One — Manual maestro de implementación (v2)

> Fuente: `Manual_Implementacion_Diseno_Ferova_One.docx` (Versión 1.0 · Julio 2026). Copiado aquí para que quede versionado junto al código que implementa. Migración detrás de `VITE_FEROVA_UI_V2` — ver estado de avance en [ROADMAP.md](./ROADMAP.md).

## Objetivo del manual

Implementar una experiencia tecnológica, clara y premium sin alterar la lógica, permisos, datos ni funcionalidades existentes del repositorio golden-access.

## 1. Veredicto de diseño

Ferova One debe sentirse como un sistema operativo ejecutivo, no como un ERP decorado. La interfaz debe priorizar decisiones, señales y acciones; las tablas y formularios aparecen después, cuando el usuario necesita operar.

**Principio rector:** Tecnología visible, complejidad invisible. El movimiento debe explicar estados, relaciones y resultados; nunca existir solo para adornar.

**Dirección visual:**
- Fondo general marfil muy claro. Nada de secciones completas negras o borgoña.
- Superficies blancas translúcidas con bordes cálidos y sombras suaves.
- Borgoña para acciones y selección; azul profundo para análisis; dorado para IA, valor y predicción.
- Lavanda, menta, coral y azul pálido para diferenciar estados sin saturar.
- Tipografía Outfit para títulos y Figtree para interfaz, manteniendo las fuentes ya instaladas en el repositorio.
- Elementos 3D puntuales: hero de landing, orb de IA, visualizaciones de módulos y estados vacíos. No convertir todo el producto en WebGL.

**Qué NO se cambia:**
- Autenticación, paywall, onboarding y permisos por plan.
- Módulos, tabs, tablas, formularios, cálculos, persistencia y Supabase.
- Google Sheets como respaldo/importación y Google Calendar en Planner.
- Command Palette, notificaciones, AI Sidebar y navegación contextual.
- Rutas públicas y privadas existentes.

## 2. Sistema de diseño

| Token | Valor | Uso | Regla |
|---|---|---|---|
| `--color-brand` | `#541014` | CTA, activo, foco | Máximo 12% del área visible |
| `--color-intelligence` | `#C0930E` | IA, predicción, logros | No usar como botón primario |
| `--color-analytics` | `#2F2D56` | Datos avanzados, gráficos | Evitar grandes fondos |
| `--color-canvas` | `#FFFDF9` | Fondo raíz | Siempre claro |
| `--color-surface` | `#FFFFFF` | Cards, paneles | Base de lectura |
| `--color-surface-soft` | `#F7F1E9` | Agrupación secundaria | Contraste muy sutil |
| `--color-positive` | `#E3F4EB` | Salud y éxito | Texto verde oscuro |
| `--color-warning` | `#F3EAD6` | Atención | No confundir con error |
| `--color-danger` | `#F7E3E4` | Riesgo y vencimiento | Solo cuando requiere acción |
| `--color-ai` | `#ECE9FF` | IA y automatización | Superficie distintiva |

Implementados como `--ferova-*` en [`src/index.css`](../src/index.css) (aditivos, no reemplazan los tokens `--bg`/`--surface`/etc. del shell actual).

**Escala de espaciamiento:** fija de 4 px: 4, 8, 12, 16, 24, 32, 48 y 64. 24 px dentro de cards principales, 16 px en controles, 32 px entre grupos y 48 px entre secciones de landing. (Cubierta por la escala default de Tailwind.)

**Radios y sombras:**
- Controles: 10–12 px · Cards estándar: 16–20 px · Cards hero o IA: 24–28 px · Píldoras: 999 px.
- Sombra base: `0 8px 24px rgba(60,35,20,.05)` · Sombra hover: `0 18px 48px rgba(60,35,20,.09)`.

## 3. Layout maestro de la aplicación

Sidebar 240–256 px + contenido flexible + asistente IA 320–380 px. El asistente puede colapsarse a una pestaña flotante de 48 px.

| Zona | Ancho/alto | Contenido | Comportamiento |
|---|---|---|---|
| Sidebar | 248 px | Secciones principales | Sticky; activa con cápsula borgoña |
| Topbar | 72–76 px | Command Palette, avisos, perfil | Sticky con blur |
| Content | minmax(0,1fr) | Módulo activo | Máximo 1280 px por módulo |
| AI Sidebar | 340 px | Brief, acciones y chat | Resizable; colapsable |
| Mobile nav | 56–64 px | 5 accesos esenciales | Fija abajo; resto en menú |

**Navegación propuesta:** Inicio (Executive Control Center) · Operación (Clientes, Servicios, Horas, Proyectos) · Finanzas (operativas, Ingresos, Pagos, Costos, Equilibrio, Por servicio, IVA, Alertas) · Ventas (CRM y Ventas; interno solo si `isTeam`) · Planner (día, semana, calendario, brain dump, bloques) · Inteligencia (Marketing ROI, Reportes CEO) · Configuración (negocio, datos, integraciones, Sheets, admin interno).

**Regla de subnavegación:** no desplegar todos los módulos simultáneamente. El sidebar muestra secciones principales; al elegir una, aparece subnavegación contextual dentro del contenido.

## 4. Executive Control Center

- Hero ejecutivo: saludo, estado resumido, máximo dos CTA.
- KPI strip: ingresos, utilidad operativa, utilidad neta, clientes activos, horas.
- Executive Brief: explicación narrativa de qué cambió y qué hacer.
- Prioridades: acciones con destino directo al módulo correcto.
- Business Health: índice visual basado en métricas existentes.
- Blind Spots: ventas ausentes, horas no registradas, equilibrio pendiente, impuestos, cobros.
- Recent Activity: ventas, horas y egresos como timeline.
- Quick Actions: registrar venta, horas, proyecto, cliente.

**Interacción:** KPIs cuentan desde 0 solo en la primera carga del periodo. Hover de 2–3px + sombra en cards (no rotar cards de datos). Secciones reordenables via Motion `layout`. Blind Spots entra escalonado 60–80ms entre elementos. Skeleton de 250–400ms mínimo al cambiar de mes.

## 5. Patrones por módulo

| Módulo | Primera capa | Segunda capa | Movimiento clave |
|---|---|---|---|
| Finanzas | Resumen y señales | Tablas y formularios | Gráficos dibujados + panel lateral |
| Operación | Proyectos y capacidad | Clientes, servicios, horas | Barras de progreso y estados |
| CRM | Kanban de pipeline | Ficha y actividad | Drag/reorder y transición de etapa |
| Planner | Agenda y bandeja | Editor y calendario | Drag, preview y aplicación de plan |
| Marketing ROI | ROI, ROAS, CAC | Campañas y calculadora | Contadores y comparación |
| Reportes | Resumen narrativo | Detalle exportable | Revelado por scroll |
| Configuración | Estado de conexiones | Formularios | Feedback de sincronización |

## 6. Sistema de movimiento

**Regla:** animar intención, no decoración. Cada animación responde a: entrada, cambio de estado, relación espacial, carga, confirmación o foco.

| Evento | Duración | Curva | Aplicación |
|---|---|---|---|
| Hover | 140–180 ms | ease-out | Botones, cards, chips |
| Entrada módulo | 220–320 ms | ease-out | Opacity + y:8→0 |
| Panel lateral | 280–380 ms | spring suave | Forms, AI, detalles |
| Reorder | 350–550 ms | spring | Dashboard y Planner |
| Gráfico | 600–1000 ms | ease-out | Líneas y barras |
| Toast | 180 ms entrada | ease-out | Confirmación |
| Skeleton | Hasta respuesta | linear shimmer | Carga real |

`motion` ya está instalado (`motion/react`). Primitivos base: [`src/components/motion/AnimatedCard.tsx`](../src/components/motion/AnimatedCard.tsx), [`src/components/motion/StaggerGroup.tsx`](../src/components/motion/StaggerGroup.tsx).

**Accesibilidad obligatoria:**
- Respetar `prefers-reduced-motion` vía `useReducedMotion` y CSS.
- No depender del movimiento para comunicar estado.
- No animar desenfoque continuo detrás de texto.
- Detener animaciones WebGL cuando la pestaña no esté visible.
- Mantener foco visible y navegación completa por teclado.

## 7. Sistema 3D

Dos niveles: producto usa 3D ligero en CSS/SVG (velocidad); landing usa una escena WebGL principal, cargada de forma diferida.

**Nivel A — 3D ligero en la interfaz:** orb del asistente con gradientes/profundidad, tarjetas hero con `perspective` (rotateX/rotateY máx. 3°), iconos de módulos en capas SVG (2–6px), gráficos con profundidad simulada. Usar `transform`/`opacity`; nunca animar `top`/`left`/`width`/`height`.

**Nivel B — escena 3D de la landing:** `three` + `@react-three/fiber` + `@react-three/drei` en rama separada, cargada con `React.lazy`/`Suspense` + poster estático. Escena: tarjetas de Ferova One flotando alrededor de un núcleo/orb inteligente (Finanzas, CRM, Planner, Reportes). Cursor inclina el conjunto; scroll separa capas y abre una tarjeta con demo. Móvil/reduced-motion: video/WebP o CSS, no WebGL continuo. No activar shadow maps salvo imprescindible.

**Presupuesto técnico:** desktop 1 escena, máx. 6–8 objetos, DPR `[1, 1.5]`. Móvil: desactivar canvas bajo 768px o en gama baja. Modelos/texturas comprimidos, hero 3D < 1.5MB. No bloquear LCP (título/CTA/poster antes que el canvas). Medir FPS; degradar si cae de 45 FPS sostenidos.

## 8. Manual de la landing

La landing no explica cada menú: demuestra que Ferova One convierte datos dispersos en decisiones, luego permite explorar demos reales.

1. **Hero** — "Tu empresa, en una mirada." CTA primario a prueba/demo, secundario a recorrido. Universo 3D interactivo a la derecha.
2. **Prueba inmediata** — barra de confianza (módulos, datos reales, integraciones, perfiles objetivo). Sin logos falsos.
3. **Problema** — costo de operar con hojas/chats/herramientas separadas; fragmentos que convergen en Ferova One.
4. **Demo Executive Control Center** — interactivo, datos ficticios claros; cambiar periodo, abrir Blind Spots, consultar IA.
5. **Módulos** — 4 escenas (Finanzas, Operación, CRM, Planner), mini demo cada una, no captura estática.
6. **IA contextual** — comparación chat vacío vs. copiloto que ya conoce el área.
7. **Cómo funciona** — Conecta → organiza → detecta → recomienda → ejecuta (scroll-linked).
8. **Casos de uso** — Freelancer, consultor, agencia, small business; cambia contenido sin recargar.
9. **Planes** — precio, módulos incluidos, regla de Founder Access. CTA directo.
10. **FAQ y cierre** — seguridad, datos, Sheets, IA, pagos, cancelación.

**Interacciones:** parallax leve solo en hero/tarjetas de módulos · scroll ensambla/separa (sin scroll hijacking) · demos por clic y teclado, datos marcados como demo · CTA con microfeedback 120–180ms · secciones con reveal escalonado una sola vez · sin video autoplay con sonido.

## 9. Arquitectura de componentes

Componentes nuevos sin reescribir servicios — la capa visual recibe los mismos datos y callbacks existentes:

```
src/components/layout/AppShell.tsx
src/components/layout/PrimaryNavigation.tsx
src/components/layout/ContextNavigation.tsx
src/components/layout/WorkspaceHeader.tsx
src/components/executive/ExecutiveHero.tsx
src/components/executive/KpiStrip.tsx
src/components/executive/ExecutiveBrief.tsx
src/components/executive/BusinessHealth.tsx
src/components/executive/BlindSpots.tsx
src/components/executive/RecentActivity.tsx
src/components/motion/AnimatedCard.tsx        ✅ implementado
src/components/motion/StaggerGroup.tsx        ✅ implementado
src/components/three/ProductUniverse.tsx
src/routes/LandingV2.tsx
```

**Migración segura:**
1. Feature flag `VITE_FEROVA_UI_V2`. ✅ implementado (`src/lib/featureFlags.ts`)
2. Extraer el shell actual sin alterar `activeTab`, `modules` ni handlers.
3. Implementar tokens y componentes base. ✅ tokens implementados (`src/index.css`)
4. Migrar Home primero y comparar métricas/acciones.
5. Migrar navegación y AI Sidebar.
6. Migrar un módulo por sprint, comenzando por Planner y Finanzas.
7. Construir demos con fixtures aislados; nunca conectar visitantes a datos reales.
8. Activar la landing nueva después de validar Core Web Vitals.

## 10. Plan de ejecución

| Fase | Qué hacer | Resultado | Validación | Estimación |
|---|---|---|---|---|
| 0 | Inventario visual y capturas | Mapa de estados | Todos los módulos y estados listados | 1–2 días |
| 1 | Tokens + componentes base | Design system funcional | Storybook/página interna sin regresiones | 2–3 días |
| 2 | AppShell + navegación | Nuevo layout | Permisos, móvil y Cmd+K funcionan | 3–4 días |
| 3 | Executive Control Center | Home completo | Mismos cálculos y destinos | 3–5 días |
| 4 | IA + Planner | Experiencia tecnológica | Resize, streaming, drag y preview | 4–6 días |
| 5 | Finanzas + CRM | Patrones principales | CRUD y filtros intactos | 5–8 días |
| 6 | Landing + demos | Página comercial | Demos aislados y responsive | 5–8 días |
| 7 | 3D + optimización | Hero premium | LCP, FPS y reduced motion aprobados | 3–5 días |

## 11. Criterios de aceptación

- Ninguna función o módulo desaparece.
- Los permisos por plan siguen ocultando módulos correctamente.
- El Dashboard conserva datos, señales, acciones y orden persistente.
- El asistente conserva historial, contexto, streaming, resize y colapso.
- El Planner conserva vistas, recurrencias, bloques, preview, IA y Calendar.
- El producto es usable con teclado y reduced motion.
- No hay secciones completas oscuras en la experiencia principal.
- El 3D nunca bloquea contenido, interacción o carga inicial.
- En móvil no hay scroll horizontal accidental.
- La landing distingue datos demo de datos reales.
- **Rendimiento:** LCP < 2.5s, CLS < 0.1, INP < 200ms en condiciones de prueba razonables.

## 12. Premortem

| Qué podría salir mal | Prevención | Plan alternativo |
|---|---|---|
| El 3D vuelve lenta la landing | Lazy load, poster, DPR limitado y medición | Desactivar WebGL y conservar composición CSS |
| El rediseño rompe permisos o navegación | No cambiar `activeTab`/`modules`; pruebas por plan | Feature flag y rollback inmediato |
| Demasiadas animaciones distraen | Motion tokens y revisión por intención | Desactivar animaciones no funcionales |
| La IA ocupa demasiado espacio | Tres estados: orb, compacto y expandido | Mantener sidebar actual como fallback |
| El diseño se vuelve inconsistente por módulo | Componentes compartidos y auditoría visual | Migrar por patrones, no pantalla por pantalla |
| Landing promete funciones inexistentes | Demos basados solo en módulos reales | Eliminar cualquier claim no comprobado |

## 13. Prompt de implementación (referencia)

> Rediseña Ferova One dentro del repositorio golden-access sin alterar lógica, servicios, tipos, cálculos, permisos, autenticación, onboarding, paywall, persistencia ni integraciones. Implementa primero tokens, AppShell y Executive Control Center. Usa Outfit/Figtree, fondo marfil, superficies blancas, borgoña #541014 como acción, navy #2F2D56 para analítica y gold #C0930E solo para IA/valor. Conserva `activeTab`, `modules`, handlers y lazy imports. Usa `motion/react` para entrada, layout, hover, paneles y reduced motion. Implementa 3D ligero en producto y una escena WebGL lazy-loaded en la landing con poster, fallback móvil y límite de rendimiento. Cada cambio debe pasar typecheck, tests, responsive, teclado, reduced motion y comparación funcional contra la versión actual.

---

## Estado de la migración

- [x] Fase 1 (parcial) — tokens `--ferova-*` en `src/index.css`, feature flag `VITE_FEROVA_UI_V2`, primitivos `AnimatedCard`/`StaggerGroup`.
- [ ] Fase 0 — inventario visual formal.
- [x] Fase 2 — AppShell + navegación. `src/components/layout/{AppShell,WorkspaceHeader,PrimaryNavigation,ContextNavigation}.tsx`. `App.tsx` ramifica el layout completo detrás de `isFerovaUiV2Enabled()`; `activeTab`, `modules`, `NAVIGATION_SECTIONS`, todos los handlers y el switch de módulos (`mainContent`) son la misma variable compartida entre el shell viejo y el nuevo — cero lógica duplicada. `PrimaryNavigation` solo muestra las secciones (icon+label, cápsula borgoña); los items de la sección activa se mueven a `ContextNavigation` en el área de contenido (regla de subnavegación del manual). Pendiente de una prueba interactiva logueada (typecheck/build/AuthScreen verificados; no hay credenciales de una cuenta paga+onboarded a mano para clickear el shell autenticado real).
- [x] Fase 3 — Executive Control Center. `src/components/executive/{ExecutiveHero,KpiStrip,ExecutiveBrief,BusinessHealth,BlindSpots,RecentActivity,PrioritiesList,QuickActionsGrid}.tsx`. `Home.tsx` mantiene exactamente los mismos cálculos (`health`, `blindSpots`, `priorities`, `activity`, `quickActions`, `sectionOrder`/`moveSection`) — solo el JSX final se ramifica detrás de `isFerovaUiV2Enabled()`, igual patrón que Fase 2. `KpiStrip` cuenta desde 0 solo la primera vez que se ve cada `selectedMonth` (`useMotionValue` + `animate` de `motion/react`, respeta `useReducedMotion`); `BlindSpots`/`RecentActivity` usan `StaggerGroup` (60-80ms). El reorder de secciones (`OrderControls`) se conserva en v2 tal cual. Verificado: typecheck y build limpios, sin errores de consola con el flag on/off (dev server) — falta la prueba interactiva logueada.
- [ ] Fase 4 — IA + Planner.
- [ ] Fase 5 — Finanzas + CRM.
- [ ] Fase 6 — Landing + demos.
- [ ] Fase 7 — 3D + optimización.
