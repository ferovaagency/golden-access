import { supabase } from './supabase';

export type PayableStatus = 'pendiente' | 'pagada' | 'vencida' | 'cancelada';

export interface Payable {
  id: string;
  proveedor: string;
  factura?: string | null;
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
}

export async function listPayables(userId: string): Promise<Payable[]> {
  const { data, error } = await (supabase as any)
    .from('finance_payables')
    .select('*')
    .eq('user_id', userId)
    .order('vencimiento', { ascending: true, nullsFirst: false });
  if (error) throw error;
  return (data || []).map((p: any) => ({ ...p, valor: Number(p.valor), monto_pagado: p.monto_pagado != null ? Number(p.monto_pagado) : null }));
}

export async function createPayable(userId: string, input: Omit<Payable, 'id'>): Promise<Payable> {
  const { data, error } = await (supabase as any).from('finance_payables').insert({ user_id: userId, ...input }).select('*').single();
  if (error) throw error;
  return data as Payable;
}

export async function updatePayable(id: string, patch: Partial<Omit<Payable, 'id'>>): Promise<void> {
  const { error } = await (supabase as any).from('finance_payables').update(patch).eq('id', id);
  if (error) throw error;
}

export async function deletePayable(id: string): Promise<void> {
  const { error } = await (supabase as any).from('finance_payables').delete().eq('id', id);
  if (error) throw error;
}

export function payableDifference(p: Payable): number {
  if (p.monto_pagado == null) return 0;
  return p.monto_pagado - p.valor;
}
