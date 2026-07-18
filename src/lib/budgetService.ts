import { supabase } from './supabase';
import type { AppData } from '../types';

export type BudgetOrigin = 'auto' | 'manual';

export interface BudgetLine {
  id: string;
  periodo: string; // YYYY-MM
  categoria: string;
  monto_presupuestado: number;
  moneda: string;
  origen: BudgetOrigin;
  notas?: string | null;
}

export async function listBudget(userId: string, periodo: string): Promise<BudgetLine[]> {
  const { data, error } = await (supabase as any)
    .from('finance_budget_monthly')
    .select('*')
    .eq('user_id', userId)
    .eq('periodo', periodo)
    .order('categoria');
  if (error) throw error;
  return (data || []).map((b: any) => ({ ...b, monto_presupuestado: Number(b.monto_presupuestado) }));
}

export async function upsertBudgetLine(userId: string, line: Omit<BudgetLine, 'id'>): Promise<void> {
  const { error } = await (supabase as any).from('finance_budget_monthly').upsert(
    { user_id: userId, ...line, updated_at: new Date().toISOString() },
    { onConflict: 'user_id,periodo,categoria' },
  );
  if (error) throw error;
}

export async function deleteBudgetLine(id: string): Promise<void> {
  const { error } = await (supabase as any).from('finance_budget_monthly').delete().eq('id', id);
  if (error) throw error;
}

// Seed a periodo from historic real data grouped by categoría
export function seedFromHistoric(data: AppData, periodo: string): Omit<BudgetLine, 'id'>[] {
  const catMap = new Map<string, number>();
  (data.pagosEgresos || []).forEach((p) => {
    catMap.set(p.categoria, (catMap.get(p.categoria) || 0) + p.monto);
  });
  (data.otrosGastos || []).forEach((g) => {
    catMap.set(g.categoria, (catMap.get(g.categoria) || 0) + g.monto);
  });
  return Array.from(catMap.entries()).map(([categoria, monto]) => ({
    periodo,
    categoria,
    monto_presupuestado: Math.round(monto),
    moneda: 'COP',
    origen: 'auto' as const,
  }));
}

export async function seedBudget(userId: string, data: AppData, periodo: string): Promise<number> {
  const rows = seedFromHistoric(data, periodo);
  for (const r of rows) await upsertBudgetLine(userId, r);
  return rows.length;
}
