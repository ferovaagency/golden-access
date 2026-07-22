import { useEffect } from 'react';
import { Head } from 'vite-react-ssg';
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
 * Doble mecanismo, a propósito:
 *
 * 1. `<Head>` (wrapper de vite-react-ssg sobre react-helmet-async) se
 *    captura durante el render de SSG y queda escrito en el HTML estatico
 *    de cada ruta (rama feat/ssg-prerender) -- esto es lo que ve un
 *    crawler que pide la URL directamente, sin ejecutar JS.
 * 2. El `useEffect` de abajo sincroniza el DOM a mano en cada navegacion
 *    del lado del cliente. Es necesario porque react-helmet-async@1.3 no
 *    actualiza el <head> de forma confiable en navegaciones SPA con esta
 *    version de React (verificado: el title queda pegado en el de la
 *    primera pagina cargada al navegar por rutas ya prerenderizadas) --
 *    bug de la libreria, no de esta implementacion. Sin este efecto, un
 *    usuario que navega sin recargar veria el title/meta de la pagina
 *    anterior.
 */
export function SeoHead({ title, description, path, ogImage, type = 'website', noindex = false, jsonLd }: SeoHeadProps) {
  const fullTitle = `${title} | ${SITE_NAME}`;
  const canonicalUrl = `${SITE_URL}${path}`;
  const image = ogImage || DEFAULT_OG_IMAGE;
  const jsonLdItems = jsonLd ? (Array.isArray(jsonLd) ? jsonLd : [jsonLd]) : [];

  useEffect(() => {
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
    if (jsonLdItems.length) {
      const script = document.createElement('script');
      script.id = scriptId;
      script.type = 'application/ld+json';
      script.textContent = JSON.stringify(jsonLdItems.length === 1 ? jsonLdItems[0] : jsonLdItems);
      document.head.appendChild(script);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullTitle, description, canonicalUrl, image, type, noindex]);

  return (
    <Head>
      <html lang="es-CO" />
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <meta name="robots" content={noindex ? 'noindex, nofollow' : 'index, follow'} />
      <link rel="canonical" href={canonicalUrl} />
      <meta property="og:type" content={type} />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image} />
      <meta property="og:url" content={canonicalUrl} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />
      {jsonLdItems.map((item, index) => (
        // eslint-disable-next-line react/no-array-index-key -- orden fijo por pagina, no reordena.
        <script key={index} type="application/ld+json">{JSON.stringify(item)}</script>
      ))}
    </Head>
  );
}
