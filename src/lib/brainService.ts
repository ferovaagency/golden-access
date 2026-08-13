import { supabase } from './supabase';

// Capa de servicio para la Memoria del negocio (cerebro). Llama a la edge
// function brain-knowledge, que aplica las reglas de admin/colaborador.

export type BrainScope = 'global' | 'privado';

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

export async function createMemoria(input: { title: string; content: string; scope: BrainScope; tags?: string[] }): Promise<string> {
  const data = await callBrain<{ id: string }>({ action: 'create', ...input });
  return data.id;
}

export async function updateMemoria(input: { id: string; title?: string; content?: string; tags?: string[] }): Promise<void> {
  await callBrain({ action: 'update', ...input });
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
