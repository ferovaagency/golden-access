// Acciones sobre la suscripción desde la app. El pago se hace en el checkout
// embebido de Whop (components/billing/WhopCheckoutModal); el acceso lo activa
// el webhook y aquí sólo se espera a verlo reflejado en user_subscriptions.
import { supabase } from './supabase';
import type { PaidTier } from './planService';

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

/**
 * Espera (hasta ~60 s) a que el webhook de Whop deje activa una suscripción
 * del plan comprado. Se compara el plan, no sólo "hay algo activo": quien
 * cambia de Medio a Pro ya tenía una fila activa antes de pagar.
 */
export function waitForPlan(userId: string, plan: PaidTier, done: (ok: boolean) => void): () => void {
  let attempts = 0;
  let stopped = false;
  const timer = window.setInterval(async () => {
    attempts += 1;
    const { data } = await supabase
      .from('user_subscriptions')
      .select('id, plan, status, expires_at')
      .eq('user_id', userId)
      .eq('provider', 'whop')
      .eq('status', 'active')
      .eq('plan', plan)
      .limit(1)
      .maybeSingle();
    const ok = !!data && (!data.expires_at || new Date(data.expires_at) >= new Date());
    if (stopped) return;
    if (ok || attempts >= 20) { stopped = true; window.clearInterval(timer); done(ok); }
  }, 3000);
  return () => { stopped = true; window.clearInterval(timer); };
}
