# Ferova One — Landing, blog y SEO

> Fuente: `Manual_Landing_Blog_SEO_Ferova_One.docx` (Julio de 2026). Copiado aquí junto con el estado real de implementación. Complementa [DESIGN_SYSTEM_V2.md](./DESIGN_SYSTEM_V2.md) (mismo sistema visual `--ferova-*`).

## Qué se implementó

| Área | Estado | Dónde |
|---|---|---|
| SEO técnico (title/description/canonical/OG/robots/JSON-LD) | ✅ | `src/seo/SeoHead.tsx`, `src/seo/StructuredData.tsx` |
| robots.txt | ✅ | `public/robots.txt` |
| sitemap.xml | ✅ generado en build | `scripts/generate-sitemap.mjs` (corre como `prebuild`) |
| Noindex en rutas privadas | ✅ | `/app`, `/admin`, `/maintenance` |
| `/landing` → `/` | ✅ | `<Navigate replace>` (ver limitación de 301 abajo) |
| `/funciones` + 4 sub-páginas | ✅ | `src/marketing/pages/Feature*Page.tsx` |
| `/precios` | ✅ | `src/marketing/pages/PricingPage.tsx` |
| Blog (MDX, índice, categorías, artículo, autor) | ✅ | `src/blog/`, `src/content/blog/*.mdx` |
| 12 primeros artículos | ✅ | ver tabla abajo |
| Analítica (eventos con nombre del manual, sec. 10) | ✅ | `src/lib/analytics.ts`, ver commit `Instrumentar analitica` |
| **Prerender/SSG real** | ✅ en rama `feat/ssg-prerender`, no mergeada a `main` todavía | ver sección dedicada abajo |

## Prerender/SSG real — implementado en `feat/ssg-prerender`

El manual (sec. 6.1) pide HTML completo servido por el servidor para cada ruta pública. Se evaluó e implementó la **Preferencia 2** ("SSG/prerender dentro de Vite, para reducir cambios") usando [`vite-react-ssg`](https://vite-react-ssg.netlify.app/), en una rama separada — **no mergeada a `main`** — por la misma razón que la escena 3D del manual de diseño: es un cambio al pipeline de build completo, no un componente aislable, y merece que Mafe lo revise (o al menos confirme que el comando de build real de Lovable Cloud lo tolera) antes de tocar producción.

**Qué cambia técnicamente:**
- `src/router.tsx` pasó de `<BrowserRouter><Routes>...</Routes></BrowserRouter>` (JSX) a un array `routes: RouteRecord[]` con un layout raíz sin path (`RootLayout`) que envuelve `ToastProvider`/`ErrorBoundary`/`Suspense`.
- `src/main.tsx` exporta `createRoot = ViteReactSSG({ routes })` en vez de llamar `createRoot().render()` directamente.
- `vite.config.ts` tiene `ssgOptions.includedRoutes` con la lista **explícita** de rutas a prerenderizar (reutiliza el mismo parser que `generate-sitemap.mjs` para leer los slugs publicados). `/app`, `/admin/*` y `/maintenance` **nunca aparecen en esa lista** — no se ejecutan en Node durante el build, punto.
- `npm run dev` **sigue siendo `vite` normal (CSR)**, sin cambios de flujo de desarrollo — solo `npm run build` cambió (ahora es `vite-react-ssg build`; `npm run build:csr` queda como escape hatch si el build de Lovable Cloud necesita el comportamiento anterior).

**Bug real encontrado y arreglado en el camino:** `react-helmet-async@1.3` (la librería que usa `vite-react-ssg` por debajo para `<Head>`) no actualiza el `<head>` de forma confiable en navegaciones del lado del cliente con esta versión de React — se verificó navegando entre páginas ya prerenderizadas y viendo el `<title>` pegado en el de la página anterior. `SeoHead.tsx` ahora hace las dos cosas a propósito: usa `<Head>` para que el HTML estático de build quede correcto (lo que ve un crawler que pide la URL directamente), y además sincroniza el `<head>` a mano vía `useEffect` en cada navegación (para que un usuario que navega sin recargar también vea el title/meta correctos). Detalle completo en los comentarios de `SeoHead.tsx`.

**Verificado en navegador, no solo por build** (sirviendo `dist/` real con `vite preview`, no el dev server):
- Cada una de las 30 rutas prerenderizadas genera su propio `.html` con `<title>`, meta, canonical y JSON-LD **únicos y correctos**, sin duplicados (se probó primero sin limpiar `index.html` y aparecían dos `<title>` compitiendo — se corrigió quitando el SEO hardcodeado de `index.html`, que ahora solo tiene charset/viewport).
- `/app` (excluido del prerender) sigue funcionando por completo vía fallback SPA + hidratación — probado con click real desde una página prerenderizada, termina en `/app` con `noindex, nofollow` correctamente aplicado.
- La calculadora de punto de equilibrio recalcula en vivo después de hidratar una página que vino del HTML estático (no solo en CSR).
- Sin errores ni warnings de hidratación en consola en ninguna ruta probada.

**Antes de mergear a `main`, falta:**
- Confirmar que el comando de build de Lovable Cloud realmente ejecuta `npm run build` (y por lo tanto recoge `vite-react-ssg build`) y no algo más específico que asuma un `dist/` puramente CSR.
- Decidir si el `/app` SPA-fallback (servir `index.html` para cualquier ruta no prerenderizada) ya funciona igual en el hosting real, o si necesita una regla de reescritura explícita — hoy funciona porque el hosting actual ya sirve la app así (confirmado: `/app` y rutas dinámicas ya funcionaban antes de este cambio).

## Decisiones de alcance dentro del blog

- **12 artículos = exactamente los 12 títulos de la sección 5.4 del manual**, cada uno asignado a su clúster más afín (no una interpretación literal de "4 pilares + 8 soportes" de la sección 11, que no cuadra aritméticamente con los 6 clústeres de la sección 5.3 — inconsistencia menor del manual original).
- **Un solo interactivo real**: la calculadora de punto de equilibrio (`src/blog/components/BreakEvenCalculator.tsx`), embebida en el artículo insignia de Rentabilidad. El resto usa tablas/checklists estáticos bien formateados, no 12 widgets interactivos bespoke.
- **Contenido tributario a nivel conceptual.** El artículo de "Finanzas Colombia" (flujo de caja) lleva un disclaimer explícito y no cita cifras ni porcentajes de IVA/retenciones como hecho — el manual pide "Revisión contable obligatoria" para este tipo de contenido, y no hay ningún contador validándolo todavía.
- **Autor placeholder único** (`equipo-ferova`) — la sección 14 del manual deja "Autores del blog" explícitamente pendiente. La arquitectura (Person schema, bio, `/autores/:slug`) está lista; falta reemplazar con personas reales.

## Pendientes antes de publicar (manual, sec. 14 — sin resolver todavía)

- [ ] **Dominio final.** `src/seo/config.ts` usa `https://ferova.one` como placeholder — un solo lugar para cambiarlo (también hay que actualizar `scripts/generate-sitemap.mjs` y `public/robots.txt`).
- [ ] **Precio, moneda y mercado definitivos.** `PricingPage.tsx` reusa USD 50/mes porque ya es el precio que corre en el resto del producto (Landing, LandingV2, paywall) — no es un número inventado, pero el manual pide reconfirmarlo antes de invertir en promocionar la página específicamente.
- [ ] **Integraciones activas por plan** — validar cada claim de `FeaturesPage`/`Feature*Page` contra lo que realmente está disponible antes de mandar tráfico pago.
- [ ] **Autores reales del blog.**
- [ ] **Revisión contable** del artículo de Finanzas Colombia y de cualquier contenido tributario futuro.
- [ ] **Datos legales del publisher** en `organizationSchema()` (`src/seo/StructuredData.tsx`).
- [ ] **Proveedor de analítica real** — `trackEvent()` empuja a `window.dataLayer` pero no hay GA4/GTM conectado todavía; conectar uno es pegar su script, no tocar el código de instrumentación.

## Limitaciones conocidas que quedan igual (independientes del SSG)

- **`/landing` no hace un 301 HTTP real** — es un redirect del lado del cliente. Una SPA (con o sin prerender) no puede emitir códigos de estado por sí sola para esto; requiere una regla a nivel de hosting/CDN cuando se defina dónde se despliega.
- **404 real**: mismo problema de fondo — `NotFound.tsx` tiene `noindex`, pero sin una regla de hosting específica el servidor puede responder `200` en vez de `404` para URLs inexistentes.
- **Search Console y QA de indexación** (Fase 6 del manual) no se puede hacer hasta que el sitio esté desplegado en el dominio final.
- **Google OAuth y `signup_complete`**: el evento `signup_complete` solo se rastrea hoy para el flujo de registro por email. El flujo de Google redirige la página de inmediato, así que no hay forma de distinguir "es una cuenta nueva" en el momento del click — requeriría comparar `user.created_at` al volver del redirect.

## Los 12 primeros artículos

| Slug | Clúster | Interactivo |
|---|---|---|
| `costo-hora-freelancer` | Rentabilidad | — |
| `punto-de-equilibrio` | Rentabilidad | ✅ calculadora |
| `horas-no-facturadas` | Rentabilidad | — |
| `cliente-rentable` | Rentabilidad | — |
| `dashboard-pequenas-empresas` | Operación | — |
| `crm-simple-etapas` | Ventas | — |
| `organizar-semana-energia` | Productividad | — |
| `que-es-sistema-operativo-empresarial` | Operación | — |
| `ia-contextual-vs-chatbot` | IA empresarial | — |
| `conectar-proyectos-horas-ingresos` | Operación | — |
| `flujo-de-caja-servicios` | Finanzas Colombia | ⚠ disclaimer contable |
| `errores-multiples-hojas-calculo` | Operación | — |
