<<<<<<< Updated upstream
// Contrato agnóstico de proveedor de pagos.
// Hoy: Paddle (preparado, en modo `awaiting_configuration` mientras faltan
// credenciales). Mañana: Stripe, PayPal, etc. sin tocar la UI.

export type PaymentProviderStatus =
  | 'ready'                // credenciales completas, checkout operativo
  | 'awaiting_configuration' // faltan claves; UI debe mostrar "próximamente"
  | 'disabled';            // deshabilitado por el admin

export interface CheckoutRequest {
  userId: string;
  email: string;
  planCode: string;
  amountUsd: number;
  currency?: 'USD' | 'COP';
  successUrl?: string;
  cancelUrl?: string;
}

export interface CheckoutResult {
  provider: 'paddle' | 'stripe' | 'paypal';
  status: PaymentProviderStatus;
  checkoutUrl?: string;
  reason?: string;
}

export interface PaymentProvider {
  id: 'paddle' | 'stripe' | 'paypal';
  status(): PaymentProviderStatus;
  createCheckout(req: CheckoutRequest): Promise<CheckoutResult>;
}

/** Adaptador Paddle. Devuelve `awaiting_configuration` si faltan claves. */
export function createPaddleAdapter(env: {
  publicClientToken?: string;
  priceId?: string;
} = {}): PaymentProvider {
  const configured = Boolean(env.publicClientToken && env.priceId);
  return {
    id: 'paddle',
    status: () => (configured ? 'ready' : 'awaiting_configuration'),
    async createCheckout(req) {
      if (!configured) {
        return {
          provider: 'paddle',
          status: 'awaiting_configuration',
          reason: 'Faltan PADDLE_PUBLIC_CLIENT_TOKEN o PADDLE_PRICE_ID.',
        };
      }
      // El checkout real se abre en cliente vía Paddle.js con el priceId.
      // Este contrato sólo emite la intención; el hosted checkout lo lanza
      // el componente <Paywall/> cuando `status === 'ready'`.
      return {
        provider: 'paddle',
        status: 'ready',
        checkoutUrl: `paddle://checkout?price=${env.priceId}&email=${encodeURIComponent(req.email)}`,
      };
    },
  };
}

// Selector activo. Hoy siempre Paddle; el día que sumemos Stripe basta con
// cambiar aquí sin tocar los consumidores.
export function getActivePaymentProvider(): PaymentProvider {
  const publicClientToken = (import.meta as any).env?.VITE_PADDLE_CLIENT_TOKEN as string | undefined;
  const priceId = (import.meta as any).env?.VITE_PADDLE_PRICE_ID as string | undefined;
  return createPaddleAdapter({ publicClientToken, priceId });
=======
export type PaymentProviderStatus = 'ready' | 'awaiting_configuration' | 'unavailable';

export interface CheckoutRequest {
  priceId: string;
  customerEmail?: string;
  customerId?: string;
}

export interface CheckoutResult {
  status: PaymentProviderStatus;
  message?: string;
}

interface PaddleJs {
  Initialize(options: { token: string; pwCustomer?: { id: string } }): void;
  Checkout: { open(options: { items: Array<{ priceId: string; quantity: number }>; customer?: { email?: string } }): void };
}

declare global {
  interface Window { Paddle?: PaddleJs; }
}

let paddleLoad: Promise<PaddleJs> | null = null;
let initializedToken: string | null = null;

function loadPaddle(): Promise<PaddleJs> {
  if (window.Paddle) return Promise.resolve(window.Paddle);
  if (paddleLoad) return paddleLoad;

  paddleLoad = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.paddle.com/paddle/v2/paddle.js';
    script.async = true;
    script.onload = () => window.Paddle ? resolve(window.Paddle) : reject(new Error('Paddle.js no se cargó correctamente.'));
    script.onerror = () => reject(new Error('No fue posible cargar Paddle.js.'));
    document.head.appendChild(script);
  });
  return paddleLoad;
}

export function getPaddleStatus(): PaymentProviderStatus {
  const token = import.meta.env.VITE_PADDLE_CLIENT_TOKEN;
  const priceId = import.meta.env.VITE_PADDLE_DEFAULT_PRICE_ID;
  return token?.startsWith('live_') && priceId?.startsWith('pri_') ? 'ready' : 'awaiting_configuration';
}

export async function openPaddleCheckout(request: CheckoutRequest): Promise<CheckoutResult> {
  const token = import.meta.env.VITE_PADDLE_CLIENT_TOKEN;
  if (getPaddleStatus() !== 'ready' || !token) {
    return { status: 'awaiting_configuration', message: 'Paddle live todavía no está configurado para este entorno.' };
  }

  try {
    const paddle = await loadPaddle();
    if (initializedToken !== token) {
      paddle.Initialize({ token, ...(request.customerId ? { pwCustomer: { id: request.customerId } } : {}) });
      initializedToken = token;
    }
    paddle.Checkout.open({
      items: [{ priceId: request.priceId, quantity: 1 }],
      ...(request.customerEmail ? { customer: { email: request.customerEmail } } : {}),
    });
    return { status: 'ready' };
  } catch (error) {
    return { status: 'unavailable', message: error instanceof Error ? error.message : 'No fue posible abrir Paddle Checkout.' };
  }
>>>>>>> Stashed changes
}
