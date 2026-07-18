import { supabase } from './supabase';

export type DebtStatus = 'activo' | 'pagado' | 'en_mora' | 'cancelado';

export interface Debt {
  id: string;
  account_id?: string | null;
  nombre: string;
  saldo_inicial: number;
  tasa?: number | null;
  cuotas?: number | null;
  fecha_corte?: string | null;
  fecha_limite?: string | null;
  estado: DebtStatus;
  moneda: string;
  notas?: string | null;
}

export interface DebtPayment {
  id: string;
  debt_id: string;
  fecha: string;
  monto: number;
  payment_method_id?: string | null;
  notas?: string | null;
}

export async function listDebts(userId: string): Promise<Debt[]> {
  const { data, error } = await (supabase as any)
    .from('finance_debts')
    .select('*')
    .eq('user_id', userId)
    .order('fecha_limite', { ascending: true, nullsFirst: false });
  if (error) throw error;
  return (data || []).map((d: any) => ({ ...d, saldo_inicial: Number(d.saldo_inicial), tasa: d.tasa != null ? Number(d.tasa) : null }));
}

export async function listDebtPayments(userId: string): Promise<DebtPayment[]> {
  const { data, error } = await (supabase as any)
    .from('finance_debt_payments')
    .select('*')
    .eq('user_id', userId)
    .order('fecha', { ascending: false });
  if (error) throw error;
  return (data || []).map((p: any) => ({ ...p, monto: Number(p.monto) }));
}

export async function createDebt(userId: string, input: Omit<Debt, 'id'>): Promise<Debt> {
  const { data, error } = await (supabase as any).from('finance_debts').insert({ user_id: userId, ...input }).select('*').single();
  if (error) throw error;
  return data as Debt;
}

export async function updateDebt(id: string, patch: Partial<Omit<Debt, 'id'>>): Promise<void> {
  const { error } = await (supabase as any).from('finance_debts').update(patch).eq('id', id);
  if (error) throw error;
}

export async function deleteDebt(id: string): Promise<void> {
  const { error } = await (supabase as any).from('finance_debts').delete().eq('id', id);
  if (error) throw error;
}

export async function addDebtPayment(userId: string, input: Omit<DebtPayment, 'id'>): Promise<DebtPayment> {
  const { data, error } = await (supabase as any).from('finance_debt_payments').insert({ user_id: userId, ...input }).select('*').single();
  if (error) throw error;
  return data as DebtPayment;
}

export function debtBalance(debt: Debt, payments: DebtPayment[]): number {
  const paid = payments.filter((p) => p.debt_id === debt.id).reduce((s, p) => s + p.monto, 0);
  return Math.max(0, debt.saldo_inicial - paid);
}
