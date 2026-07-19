import { db } from './db';

export type ReceivableStatus = 'pendiente' | 'parcial' | 'pagada' | 'vencida' | 'cancelada';

export interface Receivable {
  id: string;
  cliente_id?: string | null;
  factura?: string | null;
  documento_url?: string | null;
  documento_nombre?: string | null;
  concepto: string;
  valor: number;
  moneda: string;
  vencimiento?: string | null;
  estado: ReceivableStatus;
  notas?: string | null;
}

export interface ReceivablePayment {
  id: string;
  receivable_id: string;
  fecha: string;
  monto: number;
  payment_method_id?: string | null;
  account_id?: string | null;
  notas?: string | null;
}

type ReceivableRow = Omit<Receivable, 'valor'> & { valor: number | string };
type ReceivablePaymentRow = Omit<ReceivablePayment, 'monto'> & { monto: number | string };

export async function listReceivables(userId: string): Promise<Receivable[]> {
  const { data, error } = await db<ReceivableRow>('finance_receivables')
    .select('*')
    .eq('user_id', userId)
    .order('vencimiento', { ascending: true, nullsFirst: false });
  if (error) throw error;
  return (data ?? []).map((r) => ({ ...r, valor: Number(r.valor) }));
}

export async function listReceivablePayments(userId: string): Promise<ReceivablePayment[]> {
  const { data, error } = await db<ReceivablePaymentRow>('finance_receivable_payments')
    .select('*')
    .eq('user_id', userId)
    .order('fecha', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((p) => ({ ...p, monto: Number(p.monto) }));
}

export async function createReceivable(userId: string, input: Omit<Receivable, 'id'>): Promise<Receivable> {
  const { data, error } = await db<Receivable & { user_id: string }>('finance_receivables').insert({ user_id: userId, ...input }).select('*').single();
  if (error) throw error;
  if (!data) throw new Error('No se pudo crear la cuenta por cobrar.');
  return data;
}

export async function updateReceivable(id: string, patch: Partial<Omit<Receivable, 'id'>>): Promise<void> {
  const { error } = await db<Receivable>('finance_receivables').update(patch).eq('id', id);
  if (error) throw error;
}

export async function deleteReceivable(id: string): Promise<void> {
  const { error } = await db('finance_receivables').delete().eq('id', id);
  if (error) throw error;
}

export async function addReceivablePayment(userId: string, input: Omit<ReceivablePayment, 'id'>): Promise<ReceivablePayment> {
  const { data, error } = await db<ReceivablePayment & { user_id: string }>('finance_receivable_payments').insert({ user_id: userId, ...input }).select('*').single();
  if (error) throw error;
  if (!data) throw new Error('No se pudo registrar el abono.');
  return data;
}

export function receivableBalance(receivable: Receivable, payments: ReceivablePayment[]): number {
  const paid = payments.filter((p) => p.receivable_id === receivable.id).reduce((s, p) => s + p.monto, 0);
  return Math.max(0, receivable.valor - paid);
}
