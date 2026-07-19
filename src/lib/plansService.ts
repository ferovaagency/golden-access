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

/** Fila cruda tal como la devuelve Supabase antes de normalizar numéricos. */
type SaasPlanRow = Omit<SaasPlan, 'precio_usd' | 'modulos'> & {
  precio_usd: number | string;
  modulos: string[] | null;
};

// El cliente generado no incluye las tablas del usuario en sus tipos, por eso
// usamos un cast único aquí y tipamos las filas manualmente.
const table = () => (supabase as unknown as {
  from: (name: string) => {
    select: (cols: string) => {
      eq: (col: string, val: unknown) => { order: (col: string) => Promise<{ data: SaasPlanRow[] | null; error: Error | null }> };
    };
    update: (patch: Partial<SaasPlan>) => { eq: (col: string, val: unknown) => Promise<{ error: Error | null }> };
  };
}).from('saas_plans');

export async function listPlans(): Promise<SaasPlan[]> {
  const { data, error } = await table().select('*').eq('activo', true).order('orden');
  if (error) throw error;
  return (data ?? []).map((p): SaasPlan => ({
    ...p,
    precio_usd: Number(p.precio_usd),
    modulos: p.modulos ?? [],
  }));
}

export async function updatePlan(id: string, patch: Partial<SaasPlan>): Promise<void> {
  const { error } = await table().update(patch).eq('id', id);
  if (error) throw error;
}
