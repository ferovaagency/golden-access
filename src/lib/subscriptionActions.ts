// Acciones sobre la suscripción desde la app: agregar tarjeta (prueba sin
// tarjeta → suscripción que se renueva) y cambiar de plan. Hablan con
// `paddle-manage-subscription`; el checkout de Paddle se abre aquí.
import { supabase, checkSubscription } from './supabase';
import { openPaddleCheckout, openPaddlePaymentMethodCheckout, type PaidPlan, type Periodo } from './paddle';

type FnResponse = { ok?: boolean; code?: string; message?: string; [key: string]: unknown };

/**
 * Llama a una edge function y devuelve SIEMPRE el cuerpo JSON, también cuando
 * el servidor respondió con error. supabase-js envuelve cualquier estado
 * distinto de 2xx en "Edge Function returned a non-2xx status code" y esconde
 * el mensaje real; aquí se saca del contexto de la respuesta.
 */
export async function invokeFn(name: string, body: Record<string, unknown>): Promise<FnResponse> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (!error) return (data ?? {}) as FnResponse;
  const context = (error as { context?: Response }).context;
  if (context && typeof context.json === 'function') {
    try {
      const parsed = await context.clone().json();
      if (parsed && typeof parsed === 'object') return { ok: false, ...(parsed as FnResponse), message: (parsed as FnResponse).message || error.message };
    } catch { /* cuerpo no JSON */ }
  }
  const message = /non-2xx/i.test(error.message) ? 'El servidor respondió con error. Intenta de nuevo en unos segundos.' : error.message;
  return { ok: false, message };
}

function waitUntilPaid(userId: string, onActivated?: () => void) {
  if (!onActivated) return;
  let attempts = 0;
  const timer = window.setInterval(async () => {
    attempts += 1;
    const paid = await checkSubscription(userId).catch(() => false);
    if (paid || attempts >= 20) { window.clearInterval(timer); if (paid) onActivated(); }
  }, 3000);
}

const PLANES: readonly string[] = ['basico', 'intermedio', 'full'];

/**
 * Agregar tarjeta. Si la prueba sin tarjeta ya es una suscripción en Paddle,
 * se abre el checkout de "actualizar método de pago"; si Paddle todavía no
 * la convirtió en suscripción (checkout_required), se abre el checkout normal
 * del plan elegido y el webhook activa al pagar.
 */
export async function addPaymentMethod(userId: string, onActivated?: () => void, fallback?: { email?: string | null; plan?: PaidPlan; periodo?: Periodo }): Promise<void> {
  const data = await invokeFn('paddle-manage-subscription', { action: 'payment_method' });
  if (data.ok && typeof data.transaction_id === 'string') {
    await openPaddlePaymentMethodCheckout({
      transactionId: data.transaction_id,
      onEvent: (event) => { if (event.name === 'checkout.completed') waitUntilPaid(userId, onActivated); },
    });
    return;
  }
  if (data.code === 'checkout_required') {
    const plan = (typeof data.plan === 'string' && PLANES.includes(data.plan) ? data.plan : fallback?.plan || 'basico') as PaidPlan;
    const periodo = (data.periodo === 'anual' || fallback?.periodo === 'anual' ? 'anual' : 'mensual') as Periodo;
    await openPaddleCheckout({
      userId,
      email: fallback?.email || undefined,
      customerId: typeof data.customer_id === 'string' ? data.customer_id : null,
      plan,
      periodo,
      onEvent: (event) => { if (event.name === 'checkout.completed') waitUntilPaid(userId, onActivated); },
    });
    return;
  }
  throw new Error(data.message || 'No fue posible preparar el pago.');
}

export type ChangePlanResult = { ok: true } | { ok: false; paymentMethodRequired: true; transactionId: string } | { ok: false; paymentMethodRequired?: false; message: string };

export async function changePlan(plan: PaidPlan, periodo: Periodo): Promise<ChangePlanResult> {
  const data = await invokeFn('paddle-manage-subscription', { action: 'change_plan', plan, periodo });
  if (data.ok) return { ok: true };
  if (data.code === 'payment_method_required' && typeof data.transaction_id === 'string') return { ok: false, paymentMethodRequired: true, transactionId: data.transaction_id };
  if (data.code === 'checkout_required') return { ok: false, message: 'Tu prueba aún no tiene suscripción en Paddle: primero agrega una tarjeta con el botón "Agregar tarjeta".' };
  return { ok: false, message: data.message || 'No fue posible cambiar de plan.' };
}
