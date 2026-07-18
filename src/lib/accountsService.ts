import { supabase } from './supabase';

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

export async function listAccounts(userId: string): Promise<FinanceAccount[]> {
  const { data, error } = await (supabase as any)
    .from('finance_accounts')
    .select('id, nombre, tipo, saldo_inicial, moneda, cupo, corte_dia, pago_dia, activo, notas')
    .eq('user_id', userId)
    .order('nombre');
  if (error) throw error;
  return (data || []).map((a: any) => ({ ...a, saldo_inicial: Number(a.saldo_inicial), cupo: a.cupo != null ? Number(a.cupo) : null }));
}

export async function createAccount(userId: string, input: Omit<FinanceAccount, 'id'>): Promise<FinanceAccount> {
  const { data, error } = await (supabase as any)
    .from('finance_accounts')
    .insert({ user_id: userId, ...input })
    .select('*')
    .single();
  if (error) throw error;
  return data as FinanceAccount;
}

export async function updateAccount(id: string, patch: Partial<Omit<FinanceAccount, 'id'>>): Promise<void> {
  const { error } = await (supabase as any).from('finance_accounts').update(patch).eq('id', id);
  if (error) throw error;
}

export async function deleteAccount(id: string): Promise<void> {
  const { error } = await (supabase as any).from('finance_accounts').delete().eq('id', id);
  if (error) throw error;
}
