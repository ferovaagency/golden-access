import { supabase } from './supabase';

// CRM y Ventas propio de cada cliente pyme -- multi-tenant, filtrado siempre
// por user_id. Independiente del CRM interno de Ferova (crmService.ts).
export type ContactoEstado = 'nuevo' | 'contactado' | 'negociacion' | 'ganado' | 'perdido';

export interface Contacto {
  id: string;
  nombre_contacto: string;
  empresa: string | null;
  telefono: string | null;
  email: string | null;
  estado: ContactoEstado;
  valor_estimado: number | null;
  moneda: 'COP' | 'USD';
  notas: string | null;
  proxima_accion: string | null;
  fecha_proxima_accion: string | null;
  created_at: string;
  updated_at: string;
}

export async function listContactos(userId: string): Promise<Contacto[]> {
  const { data, error } = await (supabase as any)
    .from('biz_crm_contactos')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });
  if (error) throw new Error(`[bizCrmService] listContactos: ${error.message}`);
  return data as Contacto[];
}

export async function upsertContacto(userId: string, contacto: Partial<Contacto> & { id: string }): Promise<Contacto> {
  const { data, error } = await (supabase as any)
    .from('biz_crm_contactos')
    .upsert({ ...contacto, user_id: userId, updated_at: new Date().toISOString() })
    .select('*')
    .single();
  if (error) throw new Error(`[bizCrmService] upsertContacto: ${error.message}`);
  return data as Contacto;
}

export async function deleteContacto(userId: string, id: string): Promise<void> {
  const { error } = await (supabase as any)
    .from('biz_crm_contactos')
    .delete()
    .eq('user_id', userId)
    .eq('id', id);
  if (error) throw new Error(`[bizCrmService] deleteContacto: ${error.message}`);
}
