import { db } from './db';

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

/** Fila cruda tal como llega de Supabase antes de normalizar numéricos. */
type SaasPlanRow = Omit<SaasPlan, 'precio_usd' | 'modulos'> & {
  precio_usd: number | string;
  modulos: string[] | null;
};

export async function listPlans(): Promise<SaasPlan[]> {
  const { data, error } = await db<SaasPlanRow>('saas_plans')
    .select('*')
    .eq('activo', true)
    .order('orden');
  if (error) throw error;
  return (data ?? []).map((p): SaasPlan => ({
    ...p,
    precio_usd: Number(p.precio_usd),
    modulos: p.modulos ?? [],
  }));
}

export async function updatePlan(id: string, patch: Partial<SaasPlan>): Promise<void> {
  const { error } = await db<SaasPlanRow>('saas_plans').update(patch).eq('id', id);
  if (error) throw error;
}
