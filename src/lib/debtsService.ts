import { db } from './db';
import { registrarEgresoAutomatico } from './egresoAutomatico';

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
  /** Enlace opcional al pago/egreso del libro que corresponde a esta cuota. */
  pago_egreso_id?: string | null;
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

export async function addDebtPayment(userId: string, input: Omit<DebtPayment, 'id'>, debt?: Debt): Promise<DebtPayment> {
  const { data, error } = await db<DebtPayment & { user_id: string }>('finance_debt_payments').insert({ user_id: userId, ...input }).select('*').single();
  if (error) throw error;
  if (!data) throw new Error('No se pudo registrar el pago de deuda.');

  // La cuota sale de la caja de verdad: se refleja en Pagos & Egresos, que es
  // de donde salen el resultado real y el flujo. Antes se quedaba sólo en la
  // tabla de deudas y ningún informe la veía.
  const egresoId = await registrarEgresoAutomatico(userId, {
    id: `deuda_${data.id}`,
    fecha: data.fecha,
    concepto: `Cuota de deuda${debt?.nombre ? `: ${debt.nombre}` : ''}`,
    categoria: 'Administrativo',
    monto: data.monto,
    moneda: debt?.moneda || 'COP',
    origen: 'deuda',
    origen_ref: data.id,
    metodo_pago: data.payment_method_id ?? null,
    account_id: debt?.account_id ?? null,
    notas: data.notas ?? null,
  });

  if (egresoId) {
    // El enlace ya estaba previsto en el modelo (`pago_egreso_id`) y nadie lo
    // llenaba: con él, el flujo de caja sabe que este pago ya está contado.
    const { error: linkError } = await db('finance_debt_payments').update({ pago_egreso_id: egresoId }).eq('id', data.id);
    if (linkError) console.error('[debtsService] no se pudo enlazar el egreso', linkError.message);
  }
  return data;
}

export function debtBalance(debt: Debt, payments: DebtPayment[]): number {
  const paid = payments.filter((p) => p.debt_id === debt.id).reduce((s, p) => s + p.monto, 0);
  return Math.max(0, debt.saldo_inicial - paid);
}
