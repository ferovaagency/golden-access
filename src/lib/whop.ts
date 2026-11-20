// Whop (nov 2026): planes a la venta, afiliados y apertura del checkout.
//
// Los ids de plan (plan_…) son públicos por diseño: el checkout embebido los
// necesita en el navegador y el precio lo fija Whop, no el cliente. La API key
// y el secreto del webhook viven sólo en el servidor (supabase/functions).
//
// Variables (Lovable → entorno del front):
//   VITE_WHOP_PLAN_MEDIO_MENSUAL, VITE_WHOP_PLAN_MEDIO_ANUAL,
//   VITE_WHOP_PLAN_PRO_MENSUAL,   VITE_WHOP_PLAN_PRO_ANUAL
//   VITE_WHOP_ENV=sandbox  (opcional, para probar con tarjetas de prueba)
import type { PaidTier, Periodo } from './planService';

const env = ((import.meta as { env?: Record<string, string | undefined> }).env ?? {}) as Record<string, string | undefined>;

export const WHOP_ENVIRONMENT: 'production' | 'sandbox' = env.VITE_WHOP_ENV?.trim() === 'sandbox' ? 'sandbox' : 'production';

// Valores por defecto: Lovable no deja configurar variables VITE_, así que los
// ids de producción quedan aquí. Una variable de entorno los reemplaza.
const DEFAULT_PLAN_IDS: Record<PaidTier, Record<Periodo, string>> = {
  medio: { mensual: 'plan_ZwMC0nr2KEB5k', anual: 'plan_DJKe5WnNDnwIc' },
  pro: { mensual: 'plan_L9onuXf7jYIwA', anual: 'plan_9YW1e0bbUIXJU' },
};

const PLAN_IDS: Record<PaidTier, Record<Periodo, string>> = {
  medio: {
    mensual: env.VITE_WHOP_PLAN_MEDIO_MENSUAL?.trim() || DEFAULT_PLAN_IDS.medio.mensual,
    anual: env.VITE_WHOP_PLAN_MEDIO_ANUAL?.trim() || DEFAULT_PLAN_IDS.medio.anual,
  },
  pro: {
    mensual: env.VITE_WHOP_PLAN_PRO_MENSUAL?.trim() || DEFAULT_PLAN_IDS.pro.mensual,
    anual: env.VITE_WHOP_PLAN_PRO_ANUAL?.trim() || DEFAULT_PLAN_IDS.pro.anual,
  },
};

export function whopPlanIdFor(plan: PaidTier, periodo: Periodo): string {
  return PLAN_IDS[plan]?.[periodo] || '';
}

/** Sin id de plan configurado, el botón queda en "Próximamente": nunca se abre un checkout vacío. */
export function planIsPurchasable(plan: PaidTier, periodo: Periodo): boolean {
  return whopPlanIdFor(plan, periodo).startsWith('plan_');
}

// ---------------------------------------------------------------------------
// Afiliados. Un afiliado comparte un enlace a Ferova con `?a=<su usuario de
// Whop>` (el mismo parámetro que usan los enlaces de afiliado de Whop). Se
// guarda 30 días —la ventana por defecto de Whop— y se pasa al checkout para
// que Whop le atribuya la venta y pague la comisión configurada allá.
// ---------------------------------------------------------------------------
export const AFFILIATE_KEY = 'ferova.whop_affiliate';
const AFFILIATE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const AFFILIATE_CODE = /^[A-Za-z0-9_.-]{2,64}$/;

/** Lee `?a=` de la URL y lo guarda. El último enlace de afiliado gana. */
export function captureAffiliateFromUrl(search: string = typeof window !== 'undefined' ? window.location.search : ''): string | null {
  const code = new URLSearchParams(search).get('a')?.trim() || '';
  if (!AFFILIATE_CODE.test(code)) return null;
  try { localStorage.setItem(AFFILIATE_KEY, JSON.stringify({ code, exp: Date.now() + AFFILIATE_TTL_MS })); } catch { /* storage no disponible */ }
  return code;
}

export function getAffiliateCode(): string | null {
  try {
    const raw = localStorage.getItem(AFFILIATE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { code?: unknown; exp?: unknown };
    if (typeof parsed.code !== 'string' || !AFFILIATE_CODE.test(parsed.code)) return null;
    if (typeof parsed.exp === 'number' && parsed.exp < Date.now()) { localStorage.removeItem(AFFILIATE_KEY); return null; }
    return parsed.code;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Apertura del checkout desde cualquier parte de la app. El modal vive una
// sola vez en App.tsx y escucha estas solicitudes.
// ---------------------------------------------------------------------------
export interface CheckoutRequest { plan: PaidTier; periodo: Periodo }
type Listener = (request: CheckoutRequest) => void;
const listeners = new Set<Listener>();

export function requestCheckout(request: CheckoutRequest): void {
  listeners.forEach((listener) => listener(request));
}

export function onCheckoutRequest(listener: Listener): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** Al volver de un paso de pago fuera de la página (3DS, banco), Whop agrega `payment` y `status` a la URL. */
export function readCheckoutReturn(search: string): 'succeeded' | 'failed' | 'canceled' | 'pending' | null {
  const params = new URLSearchParams(search);
  if (params.get('checkout') !== 'whop') return null;
  const status = params.get('status');
  return status === 'succeeded' || status === 'failed' || status === 'canceled' ? status : 'pending';
}
