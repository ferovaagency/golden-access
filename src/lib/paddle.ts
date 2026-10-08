// Paddle Billing (Merchant of Record). Solo el client-side token y el price id
// viajan al navegador — son públicos por diseño, igual que una publishable key.
// El API key y el secreto de webhooks viven únicamente en el servidor.

const CLIENT_TOKEN = import.meta.env.VITE_PADDLE_CLIENT_TOKEN?.trim() || '';
/** Price id del plan único anterior (Founder Access). Se conserva como
 *  respaldo para el plan `full` mensual mientras no existan los nuevos. */
export const PADDLE_PRICE_ID = import.meta.env.VITE_PADDLE_PRICE_ID?.trim() || '';
const PADDLE_ENV = (import.meta.env.VITE_PADDLE_ENV?.trim() || 'production') as 'production' | 'sandbox';

export type PaidPlan = 'basico' | 'intermedio' | 'full';
export type Periodo = 'mensual' | 'anual';

/** Un price de Paddle por plan y periodo. Los que falten dejan el botón en
 *  "próximamente": nunca se abre un checkout con un price inexistente. */
const PRICE_IDS: Record<PaidPlan, Record<Periodo, string>> = {
  basico: { mensual: import.meta.env.VITE_PADDLE_PRICE_BASICO_MENSUAL?.trim() || '', anual: import.meta.env.VITE_PADDLE_PRICE_BASICO_ANUAL?.trim() || '' },
  intermedio: { mensual: import.meta.env.VITE_PADDLE_PRICE_INTERMEDIO_MENSUAL?.trim() || '', anual: import.meta.env.VITE_PADDLE_PRICE_INTERMEDIO_ANUAL?.trim() || '' },
  full: { mensual: import.meta.env.VITE_PADDLE_PRICE_FULL_MENSUAL?.trim() || PADDLE_PRICE_ID, anual: import.meta.env.VITE_PADDLE_PRICE_FULL_ANUAL?.trim() || '' },
};

export function priceIdFor(plan: PaidPlan, periodo: Periodo): string {
  return PRICE_IDS[plan]?.[periodo] || '';
}

export function planIsPurchasable(plan: PaidPlan, periodo: Periodo): boolean {
  return !!CLIENT_TOKEN && !!priceIdFor(plan, periodo);
}

export type PaymentProviderStatus = 'ready' | 'awaiting_configuration' | 'unavailable';

interface PaddleEvent {
  name: string;
  data?: { customer?: { id?: string }; transaction_id?: string };
}

interface PaddleCheckoutOptions {
  items: Array<{ priceId: string; quantity: number }>;
  customer?: { email?: string; id?: string };
  customData?: Record<string, string>;
  settings?: Record<string, unknown>;
}

interface PaddleJs {
  Environment: { set(env: string): void };
  Initialize(options: { token: string; eventCallback?: (event: PaddleEvent) => void }): void;
  Checkout: { open(options: PaddleCheckoutOptions): void };
}

declare global {
  interface Window { Paddle?: PaddleJs }
}

let paddleLoad: Promise<PaddleJs> | null = null;
let eventHandler: ((event: PaddleEvent) => void) | null = null;

export function getPaddleStatus(): PaymentProviderStatus {
  const anyPrice = PADDLE_PRICE_ID || (['basico', 'intermedio', 'full'] as PaidPlan[]).some((p) => priceIdFor(p, 'mensual') || priceIdFor(p, 'anual'));
  return CLIENT_TOKEN && anyPrice ? 'ready' : 'awaiting_configuration';
}

function loadScript(): Promise<PaddleJs> {
  if (window.Paddle) return Promise.resolve(window.Paddle);
  if (paddleLoad) return paddleLoad;
  paddleLoad = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.paddle.com/paddle/v2/paddle.js';
    script.async = true;
    script.onload = () => (window.Paddle ? resolve(window.Paddle) : reject(new Error('Paddle.js no se cargó correctamente.')));
    script.onerror = () => reject(new Error('No fue posible cargar Paddle.js.'));
    document.head.appendChild(script);
  });
  return paddleLoad;
}

/** Carga e inicializa Paddle.js una sola vez. */
export async function initPaddle(onEvent?: (event: PaddleEvent) => void): Promise<PaddleJs> {
  if (getPaddleStatus() !== 'ready') throw new Error('Paddle todavía no está configurado.');
  const paddle = await loadScript();
  eventHandler = onEvent || null;
  if (!(paddle as PaddleJs & { __ferovaInit?: boolean }).__ferovaInit) {
    if (PADDLE_ENV === 'sandbox') paddle.Environment.set('sandbox');
    paddle.Initialize({ token: CLIENT_TOKEN, eventCallback: (event) => eventHandler?.(event) });
    (paddle as PaddleJs & { __ferovaInit?: boolean }).__ferovaInit = true;
  }
  return paddle;
}

/** Abre el overlay de checkout de Paddle para un plan y periodo. */
export async function openPaddleCheckout(params: {
  userId: string;
  email?: string;
  customerId?: string | null;
  plan?: PaidPlan;
  periodo?: Periodo;
  onEvent?: (event: PaddleEvent) => void;
}): Promise<void> {
  const plan = params.plan || 'full';
  const periodo = params.periodo || 'mensual';
  const priceId = priceIdFor(plan, periodo);
  if (!priceId) throw new Error('Este plan todavía no está disponible para compra.');
  const paddle = await initPaddle(params.onEvent);
  paddle.Checkout.open({
    items: [{ priceId, quantity: 1 }],
    customer: params.customerId ? { id: params.customerId } : params.email ? { email: params.email } : undefined,
    // El webhook lee `plan` para guardar el nivel comprado.
    customData: { user_id: params.userId, plan, periodo },
    settings: { displayMode: 'overlay', theme: 'light', locale: 'es', allowLogout: false },
  });
}
