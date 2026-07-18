import { supabase } from './supabase';

export interface SaasPlan {
  id: string;
  nombre: string;
  descripcion?: string | null;
  precio_usd: number;
  provisional: boolean;
  activo: boolean;
  modulos: string[];
  orden: number;
}

export async function listPlans(): Promise<SaasPlan[]> {
  const { data, error } = await (supabase as any).from('saas_plans').select('*').eq('activo', true).order('orden');
  if (error) throw error;
  return (data || []).map((p: any) => ({ ...p, precio_usd: Number(p.precio_usd), modulos: p.modulos || [] }));
}

export async function updatePlan(id: string, patch: Partial<SaasPlan>): Promise<void> {
  const { error } = await (supabase as any).from('saas_plans').update(patch).eq('id', id);
  if (error) throw error;
}
