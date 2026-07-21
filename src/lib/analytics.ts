// Instrumentacion minima (Manual_Landing_Blog_SEO_Ferova_One, sec. 10).
// Sin proveedor elegido todavia -- empuja a window.dataLayer (la misma
// convencion que consumen GTM/gtag.js de forma nativa), asi que conectar
// GA4 despues es pegar su script, no reescribir esto. En dev, tambien
// loguea a consola para poder verificar sin conectar nada.
export type AnalyticsEvent =
  | 'page_view'
  | 'hero_primary_cta'
  | 'hero_demo_open'
  | 'module_demo_interaction'
  | 'pricing_view'
  | 'pricing_cta'
  | 'blog_article_view'
  | 'blog_cta_click'
  | 'signup_start'
  | 'signup_complete'
  | 'login_click';

declare global {
  interface Window { dataLayer?: unknown[] }
}

export function trackEvent(event: AnalyticsEvent, props: Record<string, unknown> = {}) {
  if (typeof window === 'undefined') return;
  const payload = { event, ...props, timestamp: new Date().toISOString() };
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(payload);
  if (import.meta.env.DEV) console.debug('[analytics]', payload);
}
