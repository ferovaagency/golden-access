import { supabase } from './supabase';

// PayPal's client-side id is meant to ship in the browser bundle (same role
// as a Stripe publishable key, not a secret) -- safe to default here when
// the Lovable build doesn't inject VITE_PAYPAL_CLIENT_ID.
const DEFAULT_PAYPAL_CLIENT_ID = 'BAA6MW3Ln249hcjLuFofoiBrcHoyxlylREWT-aXGiLMRoeUXn1awCjfQfyFUSdawHU_nd_ORtccP3Gf_MI';

// Plan de precio de lanzamiento de Ferova One en PayPal (Billing Plans).
export const PAYPAL_PLAN_ID = 'P-6ET66396M8263221VNJP2HCY';

function paypalClientId(): string {
  return import.meta.env.VITE_PAYPAL_CLIENT_ID?.trim() || DEFAULT_PAYPAL_CLIENT_ID;
}

export type PaymentProviderStatus = 'ready' | 'awaiting_configuration' | 'unavailable';

export interface CheckoutResult {
  status: PaymentProviderStatus;
  message?: string;
}

interface PaypalButtonsConfig {
  createSubscription: (data: unknown, actions: { subscription: { create: (options: { plan_id: string; custom_id: string }) => Promise<string> } }) => Promise<string>;
  onApprove: (data: { subscriptionID?: string }) => void | Promise<void>;
  onError?: (error: unknown) => void;
  style?: Record<string, string>;
}

interface PaypalJs {
  Buttons(config: PaypalButtonsConfig): { render(selector: string | HTMLElement): void };
}

declare global {
  interface Window { paypal?: PaypalJs; }
}

let paypalLoad: Promise<PaypalJs> | null = null;
let loadedClientId: string | null = null;

function loadPaypalSdk(): Promise<PaypalJs> {
  const clientId = paypalClientId();
  if (window.paypal && loadedClientId === clientId) return Promise.resolve(window.paypal);
  if (paypalLoad && loadedClientId === clientId) return paypalLoad;
  loadedClientId = clientId;
  paypalLoad = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&vault=true&intent=subscription`;
    script.async = true;
    script.onload = () => window.paypal ? resolve(window.paypal) : reject(new Error('El SDK de PayPal no se cargo correctamente.'));
    script.onerror = () => reject(new Error('No fue posible cargar el SDK de PayPal.'));
    document.head.appendChild(script);
  });
  return paypalLoad;
}

/** Only the public PayPal client id belongs in the browser bundle. */
export function getPaypalStatus(): PaymentProviderStatus {
  return paypalClientId() ? 'ready' : 'awaiting_configuration';
}

/** Loads and returns the PayPal JS SDK, ready to call `.Buttons(...).render(...)`. */
export async function loadPaypal(): Promise<PaypalJs> {
  return loadPaypalSdk();
}

/**
 * Re-verifies a subscription id returned by the browser's onApprove against
 * PayPal's own API (server-side) and activates access. Doesn't wait for the
 * webhook so the user gets in immediately after approving.
 */
export async function confirmPaypalSubscription(subscriptionId: string): Promise<CheckoutResult> {
  const { data, error } = await supabase.functions.invoke('paypal-confirm-subscription', {
    body: { subscription_id: subscriptionId },
  });
  if (error) return { status: 'unavailable', message: error.message || 'No fue posible confirmar la suscripcion.' };
  if (data?.ok !== true) return { status: 'unavailable', message: data?.message || 'PayPal no confirmo la suscripcion.' };
  return { status: 'ready' };
}
