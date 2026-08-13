// Paddle Billing (Merchant of Record). Solo el client-side token y el price id
// viajan al navegador — son públicos por diseño, igual que una publishable key.
// El API key y el secreto de webhooks viven únicamente en el servidor.

const CLIENT_TOKEN = import.meta.env.VITE_PADDLE_CLIENT_TOKEN?.trim() || '';
export const PADDLE_PRICE_ID = import.meta.env.VITE_PADDLE_PRICE_ID?.trim() || '';
const PADDLE_ENV = (import.meta.env.VITE_PADDLE_ENV?.trim() || 'production') as 'production' | 'sandbox';

/** Precio de lista en USD: incluye el ~5% de Paddle (no se absorbe). */
export const PADDLE_LIST_PRICE_USD = import.meta.env.VITE_PAYWALL_PRICE_USD?.trim() || '52.50';

/** Días de prueba con tarjeta requerida. DEBE coincidir con el trial period
 *  configurado en el price de Paddle; Paddle es quien lo aplica realmente. */
export const PADDLE_TRIAL_DAYS = Number(import.meta.env.VITE_PADDLE_TRIAL_DAYS?.trim() || '14');

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
  return CLIENT_TOKEN && PADDLE_PRICE_ID ? 'ready' : 'awaiting_configuration';
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

/** Abre el overlay de checkout de Paddle para el plan de Ferova One. */
export async function openPaddleCheckout(params: {
  userId: string;
  email?: string;
  customerId?: string | null;
  onEvent?: (event: PaddleEvent) => void;
}): Promise<void> {
  const paddle = await initPaddle(params.onEvent);
  paddle.Checkout.open({
    items: [{ priceId: PADDLE_PRICE_ID, quantity: 1 }],
    customer: params.customerId ? { id: params.customerId } : params.email ? { email: params.email } : undefined,
    customData: { user_id: params.userId },
    settings: { displayMode: 'overlay', theme: 'light', locale: 'es', allowLogout: false },
  });
}
