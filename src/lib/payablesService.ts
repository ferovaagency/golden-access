import { db } from './db';
import { registrarEgresoAutomatico } from './egresoAutomatico';

export type PayableStatus = 'pendiente' | 'pagada' | 'vencida' | 'cancelada';

export interface Payable {
  id: string;
  proveedor: string;
  factura?: string | null;
  documento_url?: string | null;
  documento_nombre?: string | null;
  concepto?: string | null;
  valor: number;
  moneda: string;
  vencimiento?: string | null;
  fecha_pago_real?: string | null;
  monto_pagado?: number | null;
  payment_method_id?: string | null;
  account_id?: string | null;
  estado: PayableStatus;
  notas?: string | null;
  /** Enlace opcional a un pago/egreso del libro (pagosEgresos). Si está
   * presente, el flujo de caja NO cuenta esta cuenta por pagar aparte (evita
   * inflar los gastos: el egreso ya lo aporta). */
  pago_egreso_id?: string | null;
}

type PayableRow = Omit<Payable, 'valor' | 'monto_pagado'> & { valor: number | string; monto_pagado: number | string | null };

export async function listPayables(userId: string): Promise<Payable[]> {
  const { data, error } = await db<PayableRow>('finance_payables')
    .select('*')
    .eq('user_id', userId)
    .order('vencimiento', { ascending: true, nullsFirst: false });
  if (error) throw error;
  return (data ?? []).map((p) => ({ ...p, valor: Number(p.valor), monto_pagado: p.monto_pagado != null ? Number(p.monto_pagado) : null }));
}

export async function createPayable(userId: string, input: Omit<Payable, 'id'>): Promise<Payable> {
  const { data, error } = await db<Payable & { user_id: string }>('finance_payables').insert({ user_id: userId, ...input }).select('*').single();
  if (error) throw error;
  if (!data) throw new Error('No se pudo crear la cuenta por pagar.');
  return data;
}

export async function updatePayable(id: string, patch: Partial<Omit<Payable, 'id'>>): Promise<void> {
  const { error } = await db<Payable>('finance_payables').update(patch).eq('id', id);
  if (error) throw error;
}

/**
 * Registra el pago de una cuenta por pagar y lo refleja en Pagos & Egresos.
 *
 * Antes esto sólo escribía `monto_pagado` y `fecha_pago_real`: el dinero salía
 * de la cuenta del negocio y no aparecía en ningún egreso, así que el resultado
 * real de caja seguía como si no se hubiera pagado nada.
 *
 * Si la cuenta ya estaba vinculada a un egreso existente (`pago_egreso_id`), no
 * se crea otro: ese egreso ya aporta la salida y duplicarlo inflaría los gastos.
 */
export async function registerPayablePayment(
  userId: string,
  payable: Payable,
  monto: number,
  fecha: string,
): Promise<void> {
  await updatePayable(payable.id, { monto_pagado: monto, fecha_pago_real: fecha, estado: 'pagada' });
  if (payable.pago_egreso_id) return;

  const egresoId = await registrarEgresoAutomatico(userId, {
    id: `cxp_${payable.id}`,
    fecha,
    concepto: `Pago a proveedor: ${payable.proveedor}${payable.factura ? ` (${payable.factura})` : ''}`,
    categoria: 'Contratistas',
    monto,
    moneda: payable.moneda || 'COP',
    origen: 'cuenta_por_pagar',
    origen_ref: payable.id,
    metodo_pago: payable.payment_method_id ?? null,
    account_id: payable.account_id ?? null,
    notas: payable.concepto ?? null,
  });
  if (egresoId) await updatePayable(payable.id, { pago_egreso_id: egresoId });
}

export async function deletePayable(id: string): Promise<void> {
  const { error } = await db('finance_payables').delete().eq('id', id);
  if (error) throw error;
}

export function payableDifference(p: Payable): number {
  if (p.monto_pagado == null) return 0;
  return p.monto_pagado - p.valor;
}
