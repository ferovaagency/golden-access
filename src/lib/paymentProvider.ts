import { supabase } from './supabase';

// Paddle's client-side token is meant to ship in the browser bundle (same
// role as a Stripe publishable key, not a secret) -- safe to default here
// when the Lovable build doesn't inject VITE_PADDLE_CLIENT_TOKEN.
const DEFAULT_PADDLE_CLIENT_TOKEN = 'live_69ecb06c95173c17cb5475e1a2b';

function paddleClientToken(): string | undefined {
  return import.meta.env.VITE_PADDLE_CLIENT_TOKEN?.trim() || DEFAULT_PADDLE_CLIENT_TOKEN;
}

export type PaymentProviderStatus = 'ready' | 'awaiting_configuration' | 'unavailable';

export interface CheckoutIntentResult {
  status: PaymentProviderStatus;
  transactionId?: string;
  message?: string;
}

export interface CheckoutResult {
  status: PaymentProviderStatus;
  message?: string;
}

interface PaddleJs {
  Initialize(options: { token: string }): void;
  Checkout: { open(options: { transactionId: string }): void };
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
    script.onload = () => window.Paddle ? resolve(window.Paddle) : reject(new Error('Paddle.js no se cargo correctamente.'));
    script.onerror = () => reject(new Error('No fue posible cargar Paddle.js.'));
    document.head.appendChild(script);
  });
  return paddleLoad;
}

/** Only the public Paddle token belongs in the browser bundle. */
export function getPaddleStatus(): PaymentProviderStatus {
  return paddleClientToken()?.startsWith('live_') ? 'ready' : 'awaiting_configuration';
}

/** Creates a server-side transaction for the current authenticated user. */
export async function createPaddleCheckoutIntent(planCode: string): Promise<CheckoutIntentResult> {
  if (getPaddleStatus() !== 'ready') {
    return { status: 'awaiting_configuration', message: 'Paddle todavia no esta configurado para este entorno.' };
  }
  const { data, error } = await supabase.functions.invoke('paddle-create-checkout', {
    body: { plan_code: planCode },
  });
  if (error) return { status: 'unavailable', message: error.message || 'No fue posible iniciar el checkout.' };
  if (typeof data?.transaction_id !== 'string' || !data.transaction_id.startsWith('txn_')) {
    return { status: 'unavailable', message: 'Paddle no devolvio una transaccion valida.' };
  }
  return { status: 'ready', transactionId: data.transaction_id };
}

export async function openPaddleCheckout(transactionId: string): Promise<CheckoutResult> {
  const token = paddleClientToken();
  if (getPaddleStatus() !== 'ready' || !token) {
    return { status: 'awaiting_configuration', message: 'Paddle todavia no esta configurado para este entorno.' };
  }
  try {
    const paddle = await loadPaddle();
    if (initializedToken !== token) {
      paddle.Initialize({ token });
      initializedToken = token;
    }
    paddle.Checkout.open({ transactionId });
    return { status: 'ready' };
  } catch (error) {
    return { status: 'unavailable', message: error instanceof Error ? error.message : 'No fue posible abrir Paddle Checkout.' };
  }
}
