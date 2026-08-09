# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primaria: **Mafe**, dueña de Ferova (agencia en evolución a "Ferova Lab"), trabajando desde la **oficina en sesiones largas de escritorio**, gestionando su propio negocio de punta a punta. Secundaria: **colaboradores del equipo** que comparten los datos del mismo negocio con permisos por pestaña (ver/editar). El producto también se vende como **SaaS a otros dueños de pyme/agencias** (multi-tenant: cada cuenta opera sobre sus propios datos vía RLS por usuario).

## Product Purpose

Ferova One es el **sistema operativo del negocio** en un solo lugar: finanzas reales, proyectos y seguimiento por cliente, planeación diaria y CRM, con un asistente de IA conectado a los datos. Existe para que un dueño de pyme **vea la verdad de su negocio y actúe** sin saltar entre hojas de cálculo y apps. Éxito = las funciones que ya existen funcionan bien, los números cuadran con la realidad, y la persona deja de procrastinar y de perder plata por falta de control.

## Positioning

Une en una sola herramienta lo que normalmente vive separado: **finanzas reales (no proyecciones)** + operación por proyecto + planeación anti-procrastinación + CRM, con un **asistente que responde con datos reales y puede crear registros** (gastos, tareas, ventas) desde el chat. Incluye **contabilidad-lite fiscal colombiana** (IVA 19%, retención, UVT, TRM, topes DIAN, punto de equilibrio) y un **Planner que aprende cuánto te toma de verdad cada tarea** y prioriza por Pareto 80/20. No es "otra plantilla SaaS": conecta caja, cobros, deudas, KPIs y agenda entre sí.

## Operating Context

- **Escena:** oficina, escritorio, sesiones largas y enfocadas; **datos densos** en pantalla (tablas de ventas, egresos, cuentas, por cobrar/pagar, KPIs). Vistazos y decisiones también entre reuniones.
- **País/fiscal:** Colombia. COP y USD con TRM; UVT, IVA, retención en la fuente, régimen simplificado vs común (Art. 437), DIAN.
- **Módulos:** Inicio/Resumen CEO · Finanzas (Ventas/Ingresos, Pagos y egresos, Gastos fijos, Finanzas operativas: cuentas/métodos/deudas/por cobrar/por pagar/presupuesto/flujo, IVA, Alertas, Equilibrio, Servicios, Clientes, Horas, Marketing ROI) · Proyectos y seguimiento por cliente (KPIs diarios→mensual/anual) · Planner · Ventas/CRM + Citas · Reportes CEO · Memoria (cerebro del negocio) · Configuración · Administración Ferova (para el equipo dueño del SaaS).
- **Infra:** repo `golden-access` (paquete `ferova-os`). Se despliega vía **Lovable** al hacer push a `main` (GitHub ↔ Lovable). Backend **Supabase (Lovable Cloud)** con RLS por `user_id` + colaboradores. Edge functions en Deno. Gateway de IA de Lovable (Gemini/GPT). **No hay preview local fácil**; se verifica con `tsc` + `vite build` y prueba en el deploy.

## Capabilities and Constraints

- Stack: **Vite + React 19 + TypeScript + Tailwind v4** (`@import "tailwindcss"` + `@theme`). **No usa shadcn**: componentes propios con clases Tailwind inline. Recharts para gráficas. Vercel AI SDK para el asistente.
- Reskin global por CSS: clases `.ferova-light-theme` y `.ferova-v2-theme` remapean clases Tailwind a la paleta del tema **sin tocar JSX** — es la palanca para cambios visuales globales.
- Tokens: capa canónica `--fv-*` en `src/index.css` como fuente única (ver DESIGN.md); los nombres viejos son alias.
- Datos reales del negocio en Supabase; el asistente lee métricas calculadas y puede crear registros.
- Restricción dura: **no romper funciones ni datos** en ningún cambio visual; **no volverlo más lento ni más confuso**.

## Brand Commitments

- Nombres: **Ferova / Ferova One / Ferova Lab**. Dominios: ferova.com.co, ferova.one, seoparaecommerce.co (vertical SEO).
- Azul de marca **#2563EB** (`--fv-brand`). Índigo #6366F1 para elementos de IA.
- Tipografías ya cargadas: **Figtree** (sans/UI) y **Outfit** (display).
- Idioma: **español** (Colombia), tono directo y práctico.

## Evidence on Hand

Datos financieros/operativos **reales** de Mafe en Supabase (ventas, egresos, clientes, KPIs). No hay testimonios, precios de terceros ni benchmarks que inventar. Cualquier dato mostrado en diseño debe salir de los datos reales o marcarse como ejemplo.

## Product Principles

1. **Datos reales primero.** Mostrar la verdad del negocio (caja, cobros, deudas), no proyecciones bonitas.
2. **Que funcione lo que ya existe** antes que agregar. Cero regresión de función o datos.
3. **Herramienta seria, con carácter propio.** Ni de juguete ni genérica: densa, legible, confiable, reconociblemente Ferova.
4. **Anti-fricción.** Encontrar y hacer las cosas debe ser más rápido, nunca más lento ni más confuso.
5. **Anti-procrastinación / claridad de decisión.** El sistema empuja a actuar sobre el 20% que da el 80%.

## Accessibility & Inclusion

Contraste legible es requisito recurrente y no negociable (texto sobre azul = blanco; texto de apoyo ≥4.5:1 sobre superficies claras). Densidad alta pero jerarquía clara para sesiones largas de escritorio.
