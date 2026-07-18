import { supabase } from './supabase';

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

export async function listReceivables(userId: string): Promise<Receivable[]> {
  const { data, error } = await (supabase as any)
    .from('finance_receivables')
    .select('*')
    .eq('user_id', userId)
    .order('vencimiento', { ascending: true, nullsFirst: false });
  if (error) throw error;
  return (data || []).map((r: any) => ({ ...r, valor: Number(r.valor) }));
}

export async function listReceivablePayments(userId: string): Promise<ReceivablePayment[]> {
  const { data, error } = await (supabase as any)
    .from('finance_receivable_payments')
    .select('*')
    .eq('user_id', userId)
    .order('fecha', { ascending: false });
  if (error) throw error;
  return (data || []).map((p: any) => ({ ...p, monto: Number(p.monto) }));
}

export async function createReceivable(userId: string, input: Omit<Receivable, 'id'>): Promise<Receivable> {
  const { data, error } = await (supabase as any).from('finance_receivables').insert({ user_id: userId, ...input }).select('*').single();
  if (error) throw error;
  return data as Receivable;
}

export async function updateReceivable(id: string, patch: Partial<Omit<Receivable, 'id'>>): Promise<void> {
  const { error } = await (supabase as any).from('finance_receivables').update(patch).eq('id', id);
  if (error) throw error;
}

export async function deleteReceivable(id: string): Promise<void> {
  const { error } = await (supabase as any).from('finance_receivables').delete().eq('id', id);
  if (error) throw error;
}

export async function addReceivablePayment(userId: string, input: Omit<ReceivablePayment, 'id'>): Promise<ReceivablePayment> {
  const { data, error } = await (supabase as any).from('finance_receivable_payments').insert({ user_id: userId, ...input }).select('*').single();
  if (error) throw error;
  return data as ReceivablePayment;
}

export function receivableBalance(receivable: Receivable, payments: ReceivablePayment[]): number {
  const paid = payments.filter((p) => p.receivable_id === receivable.id).reduce((s, p) => s + p.monto, 0);
  return Math.max(0, receivable.valor - paid);
}
