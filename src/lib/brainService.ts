import { supabase } from './supabase';

// Capa de servicio para la Memoria del negocio (cerebro). Llama a la edge
// function brain-knowledge, que aplica las reglas de admin/colaborador.

export type BrainScope = 'global' | 'privado';

// Sistema documental (réplica del método de la Bandeja de conocimiento IA de
// Notion): todo lo que escribe una IA entra "Por revisar"; el asistente sólo
// usa lo "Aprobado"; nada se borra, se archiva con nota.
export const BRAIN_TIPOS = ['Nota', 'Decisión', 'Proceso', 'Documento', 'Idea', 'Investigación'] as const;
export const BRAIN_AREAS = ['Clientes', 'Proyectos', 'Operaciones', 'Ventas', 'Desarrollo', 'Administración'] as const;
export const BRAIN_ESTADOS = ['Por revisar', 'Aprobado', 'Requiere decisión', 'Archivado'] as const;
export type BrainTipo = typeof BRAIN_TIPOS[number];
export type BrainArea = typeof BRAIN_AREAS[number];
export type BrainEstado = typeof BRAIN_ESTADOS[number];

export interface BrainBitacora { at: string; by: string; accion: string; nota: string | null }

export interface BrainItem {
  id: string;
  title: string;
  content: string;
  source: string | null;
  tags: string[];
  owner_user_id: string | null;
  alcance: BrainScope;
  created_at: string;
  updated_at: string;
  tipo: BrainTipo;
  area: BrainArea | null;
  estado: BrainEstado;
  enlace_origen: string | null;
  fecha_revision: string | null;
  bitacora: BrainBitacora[];
}

async function callBrain<T = any>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('brain-knowledge', { body });
  if (error) throw new Error(error.message || 'Error de conexión con la memoria');
  if (data && data.ok === false) throw new Error(data.message || 'Operación rechazada');
  return data as T;
}

export async function listMemoria(): Promise<{ items: BrainItem[]; isAdmin: boolean }> {
  const data = await callBrain<{ items: BrainItem[]; is_admin: boolean }>({ action: 'list' });
  return { items: data.items || [], isAdmin: !!data.is_admin };
}

export async function createMemoria(input: { title: string; content: string; scope: BrainScope; tags?: string[]; tipo?: BrainTipo; area?: BrainArea | null; estado?: BrainEstado; enlace_origen?: string | null }): Promise<string> {
  const data = await callBrain<{ id: string }>({ action: 'create', ...input });
  return data.id;
}

/** `cambio` = qué cambió y por qué; queda en la bitácora (un tema = una página viva). */
export async function updateMemoria(input: { id: string; title?: string; content?: string; tags?: string[]; tipo?: BrainTipo; area?: BrainArea | null; enlace_origen?: string | null; cambio?: string }): Promise<void> {
  await callBrain({ action: 'update', ...input });
}

/** Revisión: Aprobado / Requiere decisión / Archivado (archivar exige nota de cierre). */
export async function revisarMemoria(input: { id: string; estado: BrainEstado; nota?: string }): Promise<void> {
  await callBrain({ action: 'revisar', ...input });
}

export async function deleteMemoria(id: string): Promise<void> {
  await callBrain({ action: 'delete', id });
}

/** Construye/actualiza el cerebro automáticamente desde los datos del negocio
 *  (perfil + clientes). Devuelve cuántas entradas creó/actualizó. */
export async function syncMemoria(): Promise<{ creados: number; actualizados: number; total: number }> {
  const { data, error } = await supabase.functions.invoke('brain-sync', { body: {} });
  if (error) throw new Error(error.message || 'No se pudo sincronizar el cerebro');
  if (data && data.ok === false) throw new Error(data.message || 'No se pudo sincronizar el cerebro');
  return { creados: data?.creados ?? 0, actualizados: data?.actualizados ?? 0, total: data?.total ?? 0 };
}
