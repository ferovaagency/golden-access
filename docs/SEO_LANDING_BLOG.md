# Ferova One — Landing, blog y SEO

> Fuente: `Manual_Landing_Blog_SEO_Ferova_One.docx` (Julio de 2026). Copiado aquí junto con el estado real de implementación. Complementa [DESIGN_SYSTEM_V2.md](./DESIGN_SYSTEM_V2.md) (mismo sistema visual `--ferova-*`).

## Qué se implementó

| Área | Estado | Dónde |
|---|---|---|
| SEO técnico client-side | ✅ | `src/seo/SeoHead.tsx`, `src/seo/StructuredData.tsx` |
| robots.txt | ✅ | `public/robots.txt` |
| sitemap.xml | ✅ generado en build | `scripts/generate-sitemap.mjs` (corre como `prebuild`) |
| Noindex en rutas privadas | ✅ | `/app`, `/admin`, `/maintenance` |
| `/landing` → `/` | ✅ | `<Navigate replace>` en `router.tsx` (ver limitación de 301 abajo) |
| `/funciones` + 4 sub-páginas | ✅ | `src/marketing/pages/Feature*Page.tsx` |
| `/precios` | ✅ | `src/marketing/pages/PricingPage.tsx` |
| Blog (MDX, índice, categorías, artículo, autor) | ✅ | `src/blog/`, `src/content/blog/*.mdx` |
| 12 primeros artículos | ✅ | ver tabla abajo |
| **Prerender/SSG real** | ❌ no intentado | ver sección dedicada abajo |

## Gap deliberado: no hay prerendering/SSG real

El manual (sec. 6.1) pide HTML completo servido por el servidor para cada ruta pública — "Preferencia 1: Astro + React islands" o "Preferencia 2: SSG/prerender dentro de Vite". Ninguna de las dos se implementó en esta pasada, a propósito.

**Por qué se dejó fuera:** este repo es una SPA pura (`ReactDOM.createRoot(...).render(...)` en `src/main.tsx`, sin SSR). Migrar a Astro o integrar algo como `vite-react-ssg` cambia el pipeline de build completo — no es un componente nuevo que se pueda aislar como el resto de este trabajo. `/app` usa Supabase, `localStorage` y otras APIs de navegador en varios puntos; renderizar esa parte del árbol de rutas en Node durante un build sin probar cuidadosamente cada acceso a `window` podría romper el build de producción en Lovable Cloud sin manera fácil de detectarlo antes del deploy. Es exactamente el tipo de cambio de alto riesgo que ya se manejó aparte una vez en este proyecto (la escena 3D de la Fase 7 del manual de diseño se hizo en rama separada por la misma razón).

**Qué sí cubre lo implementado mientras tanto:** `SeoHead` actualiza `title`/`description`/`canonical`/`OG`/`robots`/JSON-LD apenas React monta cada página. Googlebot renderiza JavaScript antes de indexar (la fuente que el propio manual cita: "Google Search Central: JavaScript SEO Basics"), así que esto **no es SEO nulo** — pero el HTML inicial que ve cualquier bot que no ejecute JS (algunos crawlers de redes sociales, herramientas de auditoría rápidas) sigue siendo el `index.html` genérico hasta que React monta.

**Recomendación concreta para la siguiente sesión dedicada a esto:** evaluar `vite-react-ssg` (Preferencia 2 del manual — "reducir cambios") registrando *solo* las rutas públicas (`/`, `/funciones/*`, `/precios`, `/blog/*`) para prerender, dejando `/app` y `/admin` fuera del set de rutas que se renderizan en Node. Probar el build completo contra el pipeline real de despliegue antes de mergear a `main`.

## Decisiones de alcance dentro del blog

- **12 artículos = exactamente los 12 títulos de la sección 5.4 del manual**, cada uno asignado a su clúster más afín (no una interpretación literal de "4 pilares + 8 soportes" de la sección 11, que no cuadra aritméticamente con los 6 clústeres de la sección 5.3 — inconsistencia menor del manual original).
- **Un solo interactivo real**: la calculadora de punto de equilibrio (`src/blog/components/BreakEvenCalculator.tsx`), embebida en el artículo insignia de Rentabilidad. El resto usa tablas/checklists estáticos bien formateados, no 12 widgets interactivos bespoke.
- **Contenido tributario a nivel conceptual.** El artículo de "Finanzas Colombia" (flujo de caja) lleva un disclaimer explícito y no cita cifras ni porcentajes de IVA/retenciones como hecho — el manual pide "Revisión contable obligatoria" para este tipo de contenido, y no hay ningún contador validándolo todavía.
- **Autor placeholder único** (`equipo-ferova`) — la sección 14 del manual deja "Autores del blog" explícitamente pendiente. La arquitectura (Person schema, bio, `/autores/:slug`) está lista; falta reemplazar con personas reales.

## Pendientes antes de publicar (manual, sec. 14 — sin resolver todavía)

- [ ] **Dominio final.** `src/seo/config.ts` usa `https://ferova.one` como placeholder — un solo lugar para cambiarlo, igual que `scripts/generate-sitemap.mjs`.
- [ ] **Precio, moneda y mercado definitivos.** `PricingPage.tsx` reusa USD 50/mes porque ya es el precio que corre en el resto del producto (Landing, LandingV2, paywall) — no es un número inventado, pero el manual pide reconfirmarlo antes de invertir en promocionar la página específicamente.
- [ ] **Integraciones activas por plan** — validar cada claim de `FeaturesPage`/`Feature*Page` contra lo que realmente está disponible antes de mandar tráfico pago.
- [ ] **Autores reales del blog.**
- [ ] **Revisión contable** del artículo de Finanzas Colombia y de cualquier contenido tributario futuro.
- [ ] **Datos legales del publisher** en `organizationSchema()` (`src/seo/StructuredData.tsx`).

## Limitaciones conocidas de la implementación actual

- **`/landing` no hace un 301 HTTP real** — es un redirect del lado del cliente (`<Navigate replace>` de React Router). Una SPA sin servidor propio no puede emitir códigos de estado; esto requiere una regla a nivel de hosting/CDN cuando se defina dónde se despliega.
- **404 real**: mismo problema — `NotFound.tsx` tiene `noindex` pero el servidor siempre responde `200` con `index.html` (comportamiento estándar de SPA). Se resuelve junto con el prerendering, o con una regla de hosting específica.
- **Analítica y eventos** (`hero_primary_cta`, `signup_start`, etc. — manual sec. 10) no están instrumentados todavía.
- **Search Console y QA de indexación** (Fase 6 del manual) no se puede hacer hasta que el sitio esté desplegado en el dominio final.

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

## Verificado en navegador (no solo build)

- `robots.txt` y `sitemap.xml` sirven contenido correcto (29 URLs, incluye los 12 artículos con `lastmod` real).
- Título/descripción/canonical/robots/JSON-LD cambian correctamente por ruta (`/precios`, `/app`, artículo de blog) — confirmado leyendo el DOM, no solo el código.
- `/app` responde `noindex, nofollow`.
- La calculadora de punto de equilibrio recalcula en vivo (probado cambiando un input real y verificando el resultado).
- Breadcrumb, tabla de contenidos autogenerada, autor y artículos relacionados renderizan con datos reales en un artículo completo.
- Sin errores de consola en ninguna ruta pública ni en `/app`.
