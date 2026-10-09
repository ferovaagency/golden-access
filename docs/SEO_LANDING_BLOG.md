# Ferova One — Landing, blog y SEO

Estado: 9 de octubre de 2026. Ver [entrega del rediseño](./redesign-2026-10-09/ENTREGA.md) y [auditoría UX](./ux-audit-2026-10-08/REPORTE.md).

## Arquitectura actual

La landing está en `src/routes/Landing.tsx`, con componentes y estilos propios en `src/marketing/landing/`. Conserva la geometría del isotipo original y usa una identidad azul/blanco, aislada del diseño de la aplicación privada.

`npm run build` genera el sitemap, compila Vite y ejecuta `scripts/prerender.mjs`. Este renderiza las 33 rutas públicas usando el mismo árbol `AppRoutes`, `StaticRouter` y `SeoCollector`. Escribe contenido y metadatos estáticos en `dist`, con hidratación en el navegador. No requiere una cuenta ni acceso a datos privados. `/app`, `/admin` y `/maintenance` tienen shells sin indexación. La salida temporal `.prerender/` está ignorada por Git.

El origen canónico compartido es `https://one.ferova.com.co` en `src/seo/config.ts`. Sitemap, robots, canonical y metadatos sociales usan ese origen. Cada página pública se genera como índice de directorio y archivo HTML para compatibilidad con rutas limpias del hosting. La landing se puede leer y sus enlaces de planes funcionan sin JavaScript; las interacciones enriquecidas sí lo requieren.

Los 12 artículos originales MDX, categorías, autores y calculadora de punto de equilibrio se conservan. La página de precios y la landing usan el catálogo de planes existente. Los eventos existentes de analítica envían información a `window.dataLayer`; conectar el proveedor de medición es un paso separado.

## Comprobaciones

```bash
npm run typecheck
npm test
npm run build
npm run test:marketing
npm run preview -- --host 127.0.0.1 --port 4173
```

`test:marketing` verifica HTML de las rutas públicas, canonical, título/descripción, JSON-LD, recursos y enlaces de inicio. El servidor de preview debe responder el contenido específico tanto al abrir `/funciones` como `/funciones/`, sin necesitar ejecución de JavaScript para reconocer esa página.

## Pendientes de publicación y contenido

- Verificar en el CDN real cada ruta, robots, sitemap, imágenes y respuestas sin JavaScript. El rediseño todavía no fue publicado.
- Configurar redirección HTTP 301 de `/landing` y 404 real para rutas desconocidas. Los redirects de React son del lado cliente.
- Conectar analítica y Search Console; comprobar rastreo y medir el embudo, sin prometer posicionamiento ni aumento de conversión.
- Sustituir el autor editorial genérico por autores reales cuando estén definidos, validar los datos legales del publisher y revisar contenido tributario con el responsable contable.
- Revisar los claims de integraciones y capacidades de las demás páginas de funciones antes de campañas pagadas; estas páginas conservan su contenido anterior.

Las funciones de IA de buscadores se benefician de contenido público claro, accesible y rastreable; no requieren un archivo especial ni garantizan citas. Fuente: [Google Search Central](https://developers.google.com/search/docs/appearance/ai-features). Tipos de rastreadores de OpenAI: [documentación oficial](https://developers.openai.com/api/docs/bots).
