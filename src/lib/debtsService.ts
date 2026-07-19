import { db } from './db';

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

type DebtRow = Omit<Debt, 'saldo_inicial' | 'tasa'> & { saldo_inicial: number | string; tasa: number | string | null };
type DebtPaymentRow = Omit<DebtPayment, 'monto'> & { monto: number | string };

export async function listDebts(userId: string): Promise<Debt[]> {
  const { data, error } = await db<DebtRow>('finance_debts')
    .select('*')
    .eq('user_id', userId)
    .order('fecha_limite', { ascending: true, nullsFirst: false });
  if (error) throw error;
  return (data ?? []).map((d) => ({ ...d, saldo_inicial: Number(d.saldo_inicial), tasa: d.tasa != null ? Number(d.tasa) : null }));
}

export async function listDebtPayments(userId: string): Promise<DebtPayment[]> {
  const { data, error } = await db<DebtPaymentRow>('finance_debt_payments')
    .select('*')
    .eq('user_id', userId)
    .order('fecha', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((p) => ({ ...p, monto: Number(p.monto) }));
}

export async function createDebt(userId: string, input: Omit<Debt, 'id'>): Promise<Debt> {
  const { data, error } = await db<Debt & { user_id: string }>('finance_debts').insert({ user_id: userId, ...input }).select('*').single();
  if (error) throw error;
  if (!data) throw new Error('No se pudo crear la deuda.');
  return data;
}

export async function updateDebt(id: string, patch: Partial<Omit<Debt, 'id'>>): Promise<void> {
  const { error } = await db<Debt>('finance_debts').update(patch).eq('id', id);
  if (error) throw error;
}

export async function deleteDebt(id: string): Promise<void> {
  const { error } = await db('finance_debts').delete().eq('id', id);
  if (error) throw error;
}

export async function addDebtPayment(userId: string, input: Omit<DebtPayment, 'id'>): Promise<DebtPayment> {
  const { data, error } = await db<DebtPayment & { user_id: string }>('finance_debt_payments').insert({ user_id: userId, ...input }).select('*').single();
  if (error) throw error;
  if (!data) throw new Error('No se pudo registrar el pago de deuda.');
  return data;
}

export function debtBalance(debt: Debt, payments: DebtPayment[]): number {
  const paid = payments.filter((p) => p.debt_id === debt.id).reduce((s, p) => s + p.monto, 0);
  return Math.max(0, debt.saldo_inicial - paid);
}
