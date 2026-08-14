// Reglas puras de acceso: quién tiene derecho a entrar y con qué plan.
//
// Van aparte de `supabase.ts` a propósito. Ahí la decisión está mezclada con
// las consultas a la base y no se puede probar sin una base; aquí es una
// función de datos a booleano, y por tanto tiene prueba automática
// (tests/accessRules.test.ts). Es la regla que decide si alguien que ya no paga
// sigue entrando: merece red.

export interface SubscriptionRow {
  status: string | null;
  expires_at: string | null;
}

/**
 * ¿Esta suscripción da acceso AHORA?
 *
 * Dos condiciones, y las dos importan:
 * 1. El estado es 'active' (Paddle lo pone en 'cancelled' al cancelar).
 * 2. No está vencida. `expires_at` nulo = sin vencimiento (suscripción viva
 *    que se renueva sola); con fecha pasada, no da acceso aunque el estado
 *    haya quedado en 'active' porque un webhook no llegó.
 */
export function subscriptionGrantsAccess(
  sub: SubscriptionRow | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!sub) return false;
  if (sub.status !== 'active') return false;
  if (!sub.expires_at) return true;
  const expira = new Date(sub.expires_at);
  if (Number.isNaN(expira.getTime())) return true; // fecha ilegible: no quitar el acceso por un dato corrupto
  return expira >= now;
}
