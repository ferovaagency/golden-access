// Genera public/sitemap.xml antes de cada build (Manual_Landing_Blog_SEO_
// Ferova_One, sec. 6.4: solo URLs publicas canonicas con estado 200, sin
// rutas privadas/borradores, con lastmod real). Corre como prebuild -- ver
// package.json. No requiere Vite: parsea los .mdx directamente con fs.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const BLOG_DIR = join(ROOT, 'src', 'content', 'blog');

// Mismo SITE_URL que src/seo/config.ts -- mantenerlos sincronizados hasta
// que el dominio final este confirmado (manual, sec. 14).
const SITE_URL = 'https://ferova.one';

const STATIC_ROUTES = [
  '/',
  '/funciones',
  '/funciones/finanzas',
  '/funciones/crm',
  '/funciones/planner',
  '/funciones/asistente-ia',
  '/precios',
  '/blog',
  '/privacidad',
  '/terminos',
];

const CATEGORY_SLUGS = ['rentabilidad', 'operacion', 'ventas', 'productividad', 'ia-empresarial', 'finanzas-colombia'];
const AUTHOR_SLUGS = ['equipo-ferova'];

function extractMeta(source) {
  const marker = 'export const meta = {';
  const start = source.indexOf(marker);
  if (start === -1) return null;
  const braceStart = source.indexOf('{', start);
  let depth = 0;
  let end = -1;
  for (let i = braceStart; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    if (source[i] === '}') {
      depth -= 1;
      if (depth === 0) { end = i; break; }
    }
  }
  if (end === -1) return null;
  const objectLiteral = source.slice(braceStart, end + 1);
  try {
    // eslint-disable-next-line no-new-func -- contenido propio y confiable (src/content/blog/*.mdx), no input externo.
    return new Function(`return (${objectLiteral});`)();
  } catch (error) {
    console.warn(`[generate-sitemap] no se pudo parsear meta en un archivo: ${error.message}`);
    return null;
  }
}

function loadPublishedPosts() {
  let files = [];
  try {
    files = readdirSync(BLOG_DIR).filter((file) => file.endsWith('.mdx'));
  } catch {
    return [];
  }
  return files
    .map((file) => extractMeta(readFileSync(join(BLOG_DIR, file), 'utf-8')))
    .filter((meta) => meta && meta.status === 'published' && meta.slug);
}

const today = new Date().toISOString().slice(0, 10);
const posts = loadPublishedPosts();

const urls = [
  ...STATIC_ROUTES.map((path) => ({ path, lastmod: today })),
  ...CATEGORY_SLUGS.map((slug) => ({ path: `/blog/categoria/${slug}`, lastmod: today })),
  ...posts.map((meta) => ({ path: `/blog/${meta.slug}`, lastmod: meta.updatedAt || meta.publishedAt || today })),
  ...AUTHOR_SLUGS.map((slug) => ({ path: `/autores/${slug}`, lastmod: today })),
];

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${SITE_URL}${u.path}</loc><lastmod>${u.lastmod}</lastmod></url>`).join('\n')}
</urlset>
`;

writeFileSync(join(ROOT, 'public', 'sitemap.xml'), xml);
console.log(`[generate-sitemap] public/sitemap.xml generado con ${urls.length} URLs (${posts.length} artículos publicados).`);
