import { useEffect } from 'react';
import { SITE_URL, SITE_NAME, DEFAULT_OG_IMAGE } from './config';

export interface SeoHeadProps {
  /** Titulo de la pagina, sin el sufijo " | Ferova One" -- se agrega solo. */
  title: string;
  description: string;
  /** Path absoluto empezando en "/", ej. "/precios". Se usa para canonical y og:url. */
  path: string;
  ogImage?: string;
  type?: 'website' | 'article';
  /** true en /app, /admin, /maintenance y cualquier pantalla privada. */
  noindex?: boolean;
  /** Uno o varios objetos JSON-LD -- se serializan tal cual. */
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
}

function upsertMeta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function upsertLink(rel: string, href: string) {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

/**
 * SEO client-side para una SPA sin prerender: no sustituye a un HTML servido
 * ya indexable (ver docs/SEO_LANDING_BLOG.md, gap de prerendering), pero deja
 * title/description/canonical/OG/robots/JSON-LD correctos y unicos por ruta
 * apenas React monta -- Googlebot renderiza JS antes de indexar.
 */
export function SeoHead({ title, description, path, ogImage, type = 'website', noindex = false, jsonLd }: SeoHeadProps) {
  useEffect(() => {
    const fullTitle = `${title} | ${SITE_NAME}`;
    const canonicalUrl = `${SITE_URL}${path}`;
    const image = ogImage || DEFAULT_OG_IMAGE;

    document.documentElement.lang = 'es-CO';
    document.title = fullTitle;
    upsertMeta('name', 'description', description);
    upsertMeta('name', 'robots', noindex ? 'noindex, nofollow' : 'index, follow');
    upsertLink('canonical', canonicalUrl);

    upsertMeta('property', 'og:type', type);
    upsertMeta('property', 'og:site_name', SITE_NAME);
    upsertMeta('property', 'og:title', fullTitle);
    upsertMeta('property', 'og:description', description);
    upsertMeta('property', 'og:image', image);
    upsertMeta('property', 'og:url', canonicalUrl);
    upsertMeta('name', 'twitter:card', 'summary_large_image');
    upsertMeta('name', 'twitter:title', fullTitle);
    upsertMeta('name', 'twitter:description', description);
    upsertMeta('name', 'twitter:image', image);

    const scriptId = 'seo-jsonld';
    document.getElementById(scriptId)?.remove();
    if (jsonLd) {
      const script = document.createElement('script');
      script.id = scriptId;
      script.type = 'application/ld+json';
      script.textContent = JSON.stringify(jsonLd);
      document.head.appendChild(script);
    }
  }, [title, description, path, ogImage, type, noindex, jsonLd]);

  return null;
}
