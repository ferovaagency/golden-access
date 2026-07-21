import { supabase } from './supabase';
import { db } from './db';

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
  Initialize(options: { token: string; pwCustomer?: { id: string } }): void;
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

/**
 * Include + Initialize Paddle.js on its own, independent of opening a
 * checkout. Paddle's docs call for this on public marketing pages and on
 * in-app authenticated pages too (not just the checkout screen) so Retain
 * can run payment-recovery emails, term-optimization prompts, and in-app
 * cancellation flows outside the checkout moment. Safe to call from
 * multiple pages/mounts -- no-ops if already initialized with this token.
 * pwCustomerId is optional and only applies to logged-in pages where we
 * already know the visitor's Paddle customer id.
 */
export async function ensurePaddleJsReady(pwCustomerId?: string | null): Promise<void> {
  const token = paddleClientToken();
  if (getPaddleStatus() !== 'ready' || !token) return;
  try {
    const paddle = await loadPaddle();
    if (initializedToken === token) return;
    paddle.Initialize(pwCustomerId ? { token, pwCustomer: { id: pwCustomerId } } : { token });
    initializedToken = token;
  } catch (error) {
    // Best-effort: a Retain-only init failing must never block the page.
    console.warn('[paymentProvider] ensurePaddleJsReady:', error);
  }
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

/** Paddle customer id (ctm_...) saved by paddle-webhook once the user has ever paid; null if they haven't yet. */
export async function getMyPaddleCustomerId(userId: string): Promise<string | null> {
  const { data } = await db<{ provider_customer_id: string | null }>('user_subscriptions')
    .select('provider_customer_id')
    .eq('user_id', userId)
    .eq('provider', 'paddle')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.provider_customer_id ?? null;
}

export async function openPaddleCheckout(transactionId: string): Promise<CheckoutResult> {
  if (getPaddleStatus() !== 'ready') {
    return { status: 'awaiting_configuration', message: 'Paddle todavia no esta configurado para este entorno.' };
  }
  try {
    await ensurePaddleJsReady();
    if (!window.Paddle) throw new Error('Paddle.js no se cargo correctamente.');
    window.Paddle.Checkout.open({ transactionId });
    return { status: 'ready' };
  } catch (error) {
    return { status: 'unavailable', message: error instanceof Error ? error.message : 'No fue posible abrir Paddle Checkout.' };
  }
}
