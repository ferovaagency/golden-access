import { supabase } from './supabase';

/**
 * CRM interno de Ferova Agency (prospección, pipeline, citas, contenido).
 * Separado de finance_* (SaaS que se vende) y protegido por lista blanca
 * crm_team_members vía RLS -- ver migración create_crm_growth_ops_schema.
 */

export type CanalOrigen = 'linkedin' | 'whatsapp' | 'email' | 'reddit' | 'web' | 'googlemaps' | 'referido' | 'otro';
export type EstadoOportunidad = 'nuevo' | 'contactado' | 'calificando' | 'propuesta_enviada' | 'negociacion' | 'ganado' | 'perdido';

export interface Oportunidad {
  id: string;
  nombre_contacto: string;
  empresa: string | null;
  canal_origen: CanalOrigen;
  estado: EstadoOportunidad;
  servicio_id: string | null;
  valor_estimado: number | null;
  moneda: 'COP' | 'USD' | null;
  probabilidad: number | null;
  fuente_url: string | null;
  notas: string | null;
  siguiente_accion: string | null;
  fecha_siguiente_accion: string | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
}

export interface Interaccion {
  id: string;
  oportunidad_id: string;
  canal: 'linkedin' | 'whatsapp' | 'email' | 'reddit' | 'llamada' | 'reunion' | 'otro';
  tipo: 'mensaje_entrante' | 'mensaje_saliente' | 'comentario_sugerido' | 'nota' | 'cambio_estado';
  contenido: string | null;
  enlace: string | null;
  ocurrido_en: string;
  created_by: string | null;
}

export interface CitaDiagnostico {
  id: string;
  oportunidad_id: string | null;
  nombre_prospecto: string;
  email_prospecto: string | null;
  telefono_prospecto: string | null;
  fecha_hora: string;
  duracion_min: number;
  estado: 'agendada' | 'confirmada' | 'completada' | 'cancelada' | 'no_asistio';
  es_pagada: boolean;
  monto: number | null;
  moneda: 'COP' | 'USD' | null;
  calendar_event_id: string | null;
  meet_link: string | null;
  notas: string | null;
  created_at: string;
}

export interface ContenidoPotencial {
  id: string;
  plataforma: 'linkedin' | 'reddit';
  url_publicacion: string;
  autor: string | null;
  resumen: string | null;
  score_potencial: number | null;
  razon: string | null;
  comentario_sugerido: string | null;
  estado: 'nuevo' | 'sugerido' | 'publicado_manual' | 'descartado';
  detectado_en: string;
}

export async function isTeamMember(email: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('crm_team_members')
    .select('email')
    .eq('email', email)
    .maybeSingle();
  if (error) {
    console.error('[crmService] isTeamMember error:', error);
    return false;
  }
  return !!data;
}

export async function listOportunidades(): Promise<Oportunidad[]> {
  const { data, error } = await supabase
    .from('crm_oportunidades')
    .select('*')
    .order('updated_at', { ascending: false });
  if (error) throw new Error(`[crmService] listOportunidades: ${error.message}`);
  return data as Oportunidad[];
}

export async function upsertOportunidad(o: Partial<Oportunidad> & { id?: string }): Promise<Oportunidad> {
  const payload = { ...o, updated_at: new Date().toISOString() };
  const { data, error } = await supabase.from('crm_oportunidades').upsert(payload).select('*').single();
  if (error) throw new Error(`[crmService] upsertOportunidad: ${error.message}`);
  return data as Oportunidad;
}

export async function deleteOportunidad(id: string): Promise<void> {
  const { error } = await supabase.from('crm_oportunidades').delete().eq('id', id);
  if (error) throw new Error(`[crmService] deleteOportunidad: ${error.message}`);
}

export async function listInteracciones(oportunidadId: string): Promise<Interaccion[]> {
  const { data, error } = await supabase
    .from('crm_interacciones')
    .select('*')
    .eq('oportunidad_id', oportunidadId)
    .order('ocurrido_en', { ascending: false });
  if (error) throw new Error(`[crmService] listInteracciones: ${error.message}`);
  return data as Interaccion[];
}

export async function addInteraccion(i: Omit<Interaccion, 'id' | 'ocurrido_en'>): Promise<void> {
  const { error } = await supabase.from('crm_interacciones').insert(i);
  if (error) throw new Error(`[crmService] addInteraccion: ${error.message}`);
}

export async function listCitas(): Promise<CitaDiagnostico[]> {
  const { data, error } = await supabase
    .from('crm_citas_diagnostico')
    .select('*')
    .order('fecha_hora', { ascending: true });
  if (error) throw new Error(`[crmService] listCitas: ${error.message}`);
  return data as CitaDiagnostico[];
}

export async function upsertCita(c: Partial<CitaDiagnostico> & { id?: string }): Promise<CitaDiagnostico> {
  const { data, error } = await supabase.from('crm_citas_diagnostico').upsert(c).select('*').single();
  if (error) throw new Error(`[crmService] upsertCita: ${error.message}`);
  return data as CitaDiagnostico;
}

export async function listContenidoPotencial(): Promise<ContenidoPotencial[]> {
  const { data, error } = await supabase
    .from('crm_contenido_potencial')
    .select('*')
    .order('detectado_en', { ascending: false });
  if (error) throw new Error(`[crmService] listContenidoPotencial: ${error.message}`);
  return data as ContenidoPotencial[];
}

export async function upsertContenidoPotencial(c: Partial<ContenidoPotencial> & { id?: string }): Promise<ContenidoPotencial> {
  const { data, error } = await supabase.from('crm_contenido_potencial').upsert(c).select('*').single();
  if (error) throw new Error(`[crmService] upsertContenidoPotencial: ${error.message}`);
  return data as ContenidoPotencial;
}
