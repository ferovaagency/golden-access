# Ferova OS

Sistema operativo para emprendedores: finanzas, CRM, planificación y asistente IA — construido en Lovable con Lovable Cloud.

## Stack

- React + Vite + TypeScript + Tailwind
- Lovable Cloud (Supabase) para auth, base de datos y edge functions
- Lovable AI Gateway para el asistente y automatizaciones

## Desarrollo local

```bash
npm install
npm run dev
```

Las claves y secretos se gestionan desde Lovable — no se requiere `.env` local para el flujo básico.

## Landing y publicación estática

`npm run build` genera HTML de las 33 rutas públicas además del bundle Vite. `npm run test:marketing` comprueba contenido, metadatos y enlaces del build. Para revisar: `npm run preview -- --host 127.0.0.1 --port 4173`.

La [entrega del rediseño](docs/redesign-2026-10-09/ENTREGA.md) incluye la propuesta interactiva de interfaz interna y las evidencias de validación. La configuración de SEO se documenta en [SEO_LANDING_BLOG.md](docs/SEO_LANDING_BLOG.md).
