import { db } from './db';

// KPIs propios de cada proyecto (cliente). Cada KPI tiene una frecuencia; el
// registro diario alimenta los cálculos semanal/mensual/anual. RLS por usuario
// (user_id se llena solo con auth.uid()).

export type KpiFrecuencia = 'diaria' | 'semanal' | 'mensual';

export interface ProjectKpi {
  id: string;
  cliente_id: string;
  nombre: string;
  frecuencia: KpiFrecuencia;
  meta: number;
  unidad: string | null;
  activo: boolean;
}

export interface KpiEntry {
  id: string;
  kpi_id: string;
  fecha: string; // YYYY-MM-DD
  valor: number;
}

type KpiRow = Omit<ProjectKpi, 'meta'> & { meta: number | string };
type EntryRow = Omit<KpiEntry, 'valor'> & { valor: number | string };

export async function listProjectKpis(clienteId: string): Promise<ProjectKpi[]> {
  const { data, error } = await db<KpiRow>('project_kpis')
    .select('id, cliente_id, nombre, frecuencia, meta, unidad, activo')
    .eq('cliente_id', clienteId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(`[projectKpisService] listProjectKpis: ${error.message}`);
  return (data ?? []).map((k) => ({ ...k, meta: Number(k.meta), frecuencia: k.frecuencia as KpiFrecuencia }));
}

export async function createProjectKpi(input: { cliente_id: string; nombre: string; frecuencia: KpiFrecuencia; meta: number; unidad?: string | null }): Promise<ProjectKpi> {
  const { data, error } = await db<KpiRow>('project_kpis')
    .insert({ cliente_id: input.cliente_id, nombre: input.nombre, frecuencia: input.frecuencia, meta: input.meta, unidad: input.unidad || null })
    .select('id, cliente_id, nombre, frecuencia, meta, unidad, activo')
    .single();
  if (error) throw new Error(`[projectKpisService] createProjectKpi: ${error.message}`);
  if (!data) throw new Error('[projectKpisService] createProjectKpi: sin datos.');
  return { ...data, meta: Number(data.meta), frecuencia: data.frecuencia as KpiFrecuencia };
}

export async function updateProjectKpi(id: string, patch: Partial<Pick<ProjectKpi, 'nombre' | 'frecuencia' | 'meta' | 'unidad' | 'activo'>>): Promise<void> {
  const { error } = await db('project_kpis').update(patch).eq('id', id);
  if (error) throw new Error(`[projectKpisService] updateProjectKpi: ${error.message}`);
}

export async function deleteProjectKpi(id: string): Promise<void> {
  const { error } = await db('project_kpis').delete().eq('id', id);
  if (error) throw new Error(`[projectKpisService] deleteProjectKpi: ${error.message}`);
}

/** Entradas (registros) de un conjunto de KPIs, opcionalmente desde una fecha. */
export async function listKpiEntries(kpiIds: string[], desde?: string): Promise<KpiEntry[]> {
  if (kpiIds.length === 0) return [];
  let query = db<EntryRow>('project_kpi_entries').select('id, kpi_id, fecha, valor').in('kpi_id', kpiIds);
  if (desde) query = query.gte('fecha', desde);
  const { data, error } = await query.order('fecha', { ascending: false });
  if (error) throw new Error(`[projectKpisService] listKpiEntries: ${error.message}`);
  return (data ?? []).map((e) => ({ ...e, valor: Number(e.valor) }));
}

/** Registra (o actualiza) el valor de un KPI en una fecha. Único por (kpi, fecha). */
export async function upsertKpiEntry(kpi_id: string, fecha: string, valor: number): Promise<void> {
  const { error } = await db('project_kpi_entries').upsert({ kpi_id, fecha, valor }, { onConflict: 'kpi_id,fecha' });
  if (error) throw new Error(`[projectKpisService] upsertKpiEntry: ${error.message}`);
}
