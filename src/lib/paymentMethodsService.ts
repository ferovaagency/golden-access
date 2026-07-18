import { supabase } from './supabase';

export type PaymentMethodType = 'credito' | 'debito' | 'efectivo' | 'transferencia' | 'otro';

export interface PaymentMethod {
  id: string;
  nombre: string;
  tipo: PaymentMethodType;
  activo: boolean;
  notas?: string | null;
}

export async function listPaymentMethods(userId: string): Promise<PaymentMethod[]> {
  const { data, error } = await (supabase as any)
    .from('finance_payment_methods')
    .select('id, nombre, tipo, activo, notas')
    .eq('user_id', userId)
    .order('nombre');
  if (error) throw error;
  return (data || []) as PaymentMethod[];
}

export async function createPaymentMethod(userId: string, input: Omit<PaymentMethod, 'id'>): Promise<PaymentMethod> {
  const { data, error } = await (supabase as any)
    .from('finance_payment_methods')
    .insert({ user_id: userId, ...input })
    .select('id, nombre, tipo, activo, notas')
    .single();
  if (error) throw error;
  return data as PaymentMethod;
}

export async function updatePaymentMethod(id: string, patch: Partial<Omit<PaymentMethod, 'id'>>): Promise<void> {
  const { error } = await (supabase as any).from('finance_payment_methods').update(patch).eq('id', id);
  if (error) throw error;
}

export async function deletePaymentMethod(id: string): Promise<void> {
  const { error } = await (supabase as any).from('finance_payment_methods').delete().eq('id', id);
  if (error) throw error;
}
