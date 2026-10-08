// Acciones sobre la suscripción desde la app: agregar tarjeta (prueba sin
// tarjeta → suscripción que se renueva) y cambiar de plan. Hablan con
// `paddle-manage-subscription`; el checkout de Paddle se abre aquí.
import { supabase, checkSubscription } from './supabase';
import { openPaddlePaymentMethodCheckout, type PaidPlan, type Periodo } from './paddle';

export async function addPaymentMethod(userId: string, onActivated?: () => void): Promise<void> {
  const { data, error } = await supabase.functions.invoke('paddle-manage-subscription', { body: { action: 'payment_method' } });
  if (error) throw new Error(error.message);
  if (!data?.ok || !data.transaction_id) throw new Error(data?.message || 'No fue posible preparar el pago.');
  await openPaddlePaymentMethodCheckout({
    transactionId: data.transaction_id,
    onEvent: (event) => {
      if (event.name !== 'checkout.completed' || !onActivated) return;
      let attempts = 0;
      const timer = window.setInterval(async () => {
        attempts += 1;
        const paid = await checkSubscription(userId).catch(() => false);
        if (paid || attempts >= 20) { window.clearInterval(timer); if (paid) onActivated(); }
      }, 3000);
    },
  });
}

export type ChangePlanResult = { ok: true } | { ok: false; paymentMethodRequired: true; transactionId: string } | { ok: false; paymentMethodRequired?: false; message: string };

export async function changePlan(plan: PaidPlan, periodo: Periodo): Promise<ChangePlanResult> {
  const { data, error } = await supabase.functions.invoke('paddle-manage-subscription', { body: { action: 'change_plan', plan, periodo } });
  if (error) return { ok: false, message: error.message };
  if (data?.ok) return { ok: true };
  if (data?.code === 'payment_method_required' && data.transaction_id) return { ok: false, paymentMethodRequired: true, transactionId: data.transaction_id };
  return { ok: false, message: data?.message || 'No fue posible cambiar de plan.' };
}
