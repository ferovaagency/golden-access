/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  readonly VITE_SUPABASE_PROJECT_ID?: string;
  /** PayPal client-side id. Público, seguro de exponer en el navegador. */
  readonly VITE_PAYPAL_CLIENT_ID?: string;
  readonly VITE_PAYWALL_PRICE_USD?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module '*.json' {
  const value: any;
  export default value;
}
