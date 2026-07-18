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
}
