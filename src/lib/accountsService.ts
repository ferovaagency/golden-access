import { db } from './db';

export type AccountType = 'banco' | 'efectivo' | 'tarjeta_credito' | 'credito_prestamo';

export interface FinanceAccount {
  id: string;
  nombre: string;
  tipo: AccountType;
  saldo_inicial: number;
  moneda: string;
  cupo?: number | null;
  corte_dia?: number | null;
  pago_dia?: number | null;
  activo: boolean;
  notas?: string | null;
}

/** Fila cruda: numéricos pueden llegar como string en jsonb/numeric. */
type FinanceAccountRow = Omit<FinanceAccount, 'saldo_inicial' | 'cupo'> & {
  saldo_inicial: number | string;
  cupo: number | string | null;
};

const COLS = 'id, nombre, tipo, saldo_inicial, moneda, cupo, corte_dia, pago_dia, activo, notas';

export async function listAccounts(userId: string): Promise<FinanceAccount[]> {
  const { data, error } = await db<FinanceAccountRow>('finance_accounts')
    .select(COLS)
    .eq('user_id', userId)
    .order('nombre');
  if (error) throw error;
  return (data ?? []).map((a): FinanceAccount => ({
    ...a,
    saldo_inicial: Number(a.saldo_inicial),
    cupo: a.cupo != null ? Number(a.cupo) : null,
  }));
}

export async function createAccount(userId: string, input: Omit<FinanceAccount, 'id'>): Promise<FinanceAccount> {
  const { data, error } = await db<FinanceAccountRow>('finance_accounts')
    .insert({ ...(input as unknown as Partial<FinanceAccountRow>), user_id: userId } as Partial<FinanceAccountRow>)
    .select('*')
    .single();
  if (error) throw error;
  if (!data) throw new Error('No se pudo crear la cuenta');
  return {
    ...data,
    saldo_inicial: Number(data.saldo_inicial),
    cupo: data.cupo != null ? Number(data.cupo) : null,
  };
}

export async function updateAccount(id: string, patch: Partial<Omit<FinanceAccount, 'id'>>): Promise<void> {
  const { error } = await db<FinanceAccountRow>('finance_accounts')
    .update(patch as Partial<FinanceAccountRow>)
    .eq('id', id);
  if (error) throw error;
}

export async function deleteAccount(id: string): Promise<void> {
  const { error } = await db<FinanceAccountRow>('finance_accounts').delete().eq('id', id);
  if (error) throw error;
}
