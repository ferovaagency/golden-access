import { readdirSync, readFileSync } from 'fs';
import mdx from '@mdx-js/rollup';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

// Mismo parser que scripts/generate-sitemap.mjs (duplicado a proposito: son
// dos utilidades pequenas de build-time, no vale la pena compartir modulo
// entre vite.config.ts y un script standalone).
function extractMeta(source: string): { slug?: string; status?: string } | null {
  const marker = 'export const meta = {';
  const start = source.indexOf(marker);
  if (start === -1) return null;
  const braceStart = source.indexOf('{', start);
  let depth = 0;
  let end = -1;
  for (let i = braceStart; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    if (source[i] === '}') { depth -= 1; if (depth === 0) { end = i; break; } }
  }
  if (end === -1) return null;
  try {
    // eslint-disable-next-line no-new-func -- contenido propio y confiable.
    return new Function(`return (${source.slice(braceStart, end + 1)});`)();
  } catch { return null; }
}

function publishedBlogSlugs(): string[] {
  const blogDir = path.resolve(__dirname, 'src/content/blog');
  let files: string[] = [];
  try { files = readdirSync(blogDir).filter((f) => f.endsWith('.mdx')); } catch { return []; }
  return files
    .map((file) => extractMeta(readFileSync(path.join(blogDir, file), 'utf-8')))
    .filter((meta): meta is { slug: string; status: string } => Boolean(meta?.slug && meta.status === 'published'))
    .map((meta) => meta.slug);
}

const CATEGORY_SLUGS = ['rentabilidad', 'operacion', 'ventas', 'productividad', 'ia-empresarial', 'finanzas-colombia'];
const AUTHOR_SLUGS = ['equipo-ferova'];

export default defineConfig(() => {
  return {
    // mdx() debe ir antes que react() -- compila .mdx a JSX que el plugin de
    // React despues transforma. Contenido del blog (Manual_Landing_Blog_SEO).
    plugins: [{ enforce: 'pre' as const, ...mdx() }, react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    // vite-react-ssg (rama feat/ssg-prerender): lista explicita de rutas a
    // prerenderizar. /app, /admin/* y /maintenance NUNCA aparecen aca --
    // nunca se ejecutan en Node durante el build. Manual_Landing_Blog_SEO,
    // sec. 6.1.
    ssgOptions: {
      includedRoutes: () => [
        '/',
        '/landing-v2',
        '/funciones',
        '/funciones/finanzas',
        '/funciones/crm',
        '/funciones/planner',
        '/funciones/asistente-ia',
        '/precios',
        '/blog',
        '/privacidad',
        '/terminos',
        ...CATEGORY_SLUGS.map((slug) => `/blog/categoria/${slug}`),
        ...publishedBlogSlugs().map((slug) => `/blog/${slug}`),
        ...AUTHOR_SLUGS.map((slug) => `/autores/${slug}`),
      ],
    },
  };
});
