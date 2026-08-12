/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  readonly VITE_SUPABASE_PROJECT_ID?: string;
  /** Client-side token de Paddle. Público, seguro de exponer en el navegador. */
  readonly VITE_PADDLE_CLIENT_TOKEN?: string;
  /** Price id de Paddle (pri_...) del plan de Ferova One. */
  readonly VITE_PADDLE_PRICE_ID?: string;
  /** 'sandbox' o 'production' (default). */
  readonly VITE_PADDLE_ENV?: string;
  readonly VITE_PAYWALL_PRICE_USD?: string;
  /** DSN de Sentry. Sin él, la observabilidad es no-op. */
  readonly VITE_SENTRY_DSN?: string;
  /** Feature flag: activa el rediseño Ferova One v2 (ver Manual_Implementacion_Diseno_Ferova_One). */
  readonly VITE_FEROVA_UI_V2?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module '*.json' {
  const value: any;
  export default value;
}

declare module '*.mdx' {
  import type { ComponentType } from 'react';
  export const meta: import('./content/blog/postMeta').PostMeta;
  const MDXComponent: ComponentType<Record<string, unknown>>;
  export default MDXComponent;
}
