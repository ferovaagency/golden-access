import { supabase, getAccessToken } from './supabase';



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
  telefono: string | null;
  email: string | null;
  notas: string | null;
  siguiente_accion: string | null;
  fecha_siguiente_accion: string | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  apollo_data?: any | null;
  apollo_enriched_at?: string | null;
  playbook_email?: string | null;
  playbook_linkedin_conectar?: boolean | null;
  playbook_linkedin_nota?: string | null;
  playbook_linkedin_mensaje?: string | null;
  playbook_whatsapp_mensaje?: string | null;
  playbook_generated_at?: string | null;
  memoria_resumen?: string | null;
  memoria_updated_at?: string | null;
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
  source?: string | null;
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
export interface ServicioCatalogo {
  id: string;
  nombre: string;
  costo_unitario: number;
}

export async function listServiciosCatalogo(userId: string): Promise<ServicioCatalogo[]> {
  const { data, error } = await supabase
    .from('finance_servicios')
    .select('id, nombre, costo_unitario')
    .eq('user_id', userId)
    .order('nombre');
  if (error) throw new Error(`[crmService] listServiciosCatalogo: ${error.message}`);
  return (data || []).map((s: any) => ({ id: s.id, nombre: s.nombre, costo_unitario: Number(s.costo_unitario) }));
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
  const { data, error } = await (supabase as any).from('crm_oportunidades').upsert(payload).select('*').single();
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
  const { data, error } = await (supabase as any).from('crm_citas_diagnostico').upsert(c).select('*').single();
  if (error) throw new Error(`[crmService] upsertCita: ${error.message}`);
  return data as CitaDiagnostico;
}

export async function bookCita(payload: {
  oportunidad_id?: string | null;
  nombre_prospecto: string;
  email_prospecto?: string | null;
  telefono_prospecto?: string | null;
  fecha_hora: string;
  duracion_min?: number;
  notas?: string | null;
}): Promise<CitaDiagnostico> {
  const { data, error } = await supabase.functions.invoke('calendar-book', { body: payload });
  if (error) throw error;
  if (!data?.ok) throw new Error(data?.message || 'No se pudo agendar la cita.');
  return data.cita as CitaDiagnostico;
}

export async function cancelCita(cita_id: string): Promise<CitaDiagnostico> {
  const { data, error } = await supabase.functions.invoke('calendar-cancel', { body: { cita_id } });
  if (error) throw error;
  if (!data?.ok) throw new Error(data?.message || 'No se pudo cancelar la cita.');
  return data.cita as CitaDiagnostico;
}

export async function syncBookingLinkCitas(days = 30): Promise<{ scanned: number; inserted: number; skipped: number; citas: CitaDiagnostico[] }> {
  const { data, error } = await supabase.functions.invoke('calendar-sync-bookings', { body: { days } });
  if (error) throw error;
  if (!data?.ok) throw new Error(data?.message || 'No se pudieron sincronizar reservas.');
  return data;
}

export async function analyzeContenido(payload: {
  plataforma?: 'linkedin' | 'reddit';
  url_publicacion: string;
  autor?: string | null;
  texto: string;
}): Promise<ContenidoPotencial> {
  const { data, error } = await supabase.functions.invoke('linkedin-analyze', { body: payload });
  if (error) throw error;
  if (!data?.ok) throw new Error(data?.message || 'No se pudo analizar el contenido.');
  return data.contenido as ContenidoPotencial;
}

// ============================================================
// Reddit: traer publicaciones de un subreddit
// ============================================================
export interface RedditPost {
  id: string;
  title: string;
  selftext: string;
  author: string;
  subreddit: string;
  num_comments: number;
  score: number;
  upvote_ratio: number;
  created_utc: number;
  url: string;
  link_flair_text: string | null;
  is_self: boolean;
}

export interface LinkedInSearchResult {
  id: string;
  title: string;
  snippet: string;
  url: string;
  author: string | null;
  source: string;
}

export async function fetchSubredditPosts(payload: {
  subreddit: string;
  listing?: 'new' | 'hot' | 'top' | 'rising';
  limit?: number;
  timeframe?: 'hour' | 'day' | 'week' | 'month' | 'year' | 'all';
}): Promise<RedditPost[]> {
  const { data, error } = await supabase.functions.invoke('reddit-fetch-subreddit', { body: payload });
  if (error) throw error;
  if (!data?.ok) throw new Error(data?.message || 'No se pudo traer el subreddit.');
  return data.posts as RedditPost[];
}

export async function searchRedditByKeywords(payload: {
  keywords: string[];
  subreddits?: string[];
  sort?: 'relevance' | 'new' | 'hot' | 'top' | 'comments';
  timeframe?: 'hour' | 'day' | 'week' | 'month' | 'year' | 'all';
  limit?: number;
}): Promise<RedditPost[]> {
  const { data, error } = await supabase.functions.invoke('reddit-search-keywords', { body: payload });
  if (error) throw error;
  if (!data?.ok) throw new Error(data?.message || 'No se pudo buscar en Reddit.');
  return data.posts as RedditPost[];
}

export async function searchLinkedInByKeywords(payload: {
  keywords: string[];
  limit?: number;
}): Promise<LinkedInSearchResult[]> {
  const { data, error } = await supabase.functions.invoke('linkedin-search-keywords', { body: payload });
  if (error) throw error;
  if (!data?.ok) throw new Error(data?.message || 'No se pudo buscar en LinkedIn.');
  return data.results as LinkedInSearchResult[];
}

export async function enrichOportunidadApollo(payload: {
  oportunidad_id?: string;
  nombre_contacto?: string;
  empresa?: string;
  dominio?: string;
  linkedin_url?: string;
  email?: string;
  canal_origen?: string;
  fuente_url?: string;
  contexto_publicacion?: string;
}): Promise<Oportunidad> {
  const { data, error } = await supabase.functions.invoke('apollo-enrich-playbook', { body: payload });
  if (error) throw error;
  if (!data?.ok) throw new Error(data?.message || 'No se pudo enriquecer con Apollo.');
  return data.oportunidad as Oportunidad;
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
  const { data, error } = await (supabase as any).from('crm_contenido_potencial').upsert(c).select('*').single();
  if (error) throw new Error(`[crmService] upsertContenidoPotencial: ${error.message}`);
  return data as ContenidoPotencial;
}

// ============================================================
// Bot de WhatsApp (config + base de conocimiento entrenable)
// ============================================================
export interface BotConfig {
  bot_enabled: boolean;
  custom_prompt: string | null;
  instance_name: string;
  updated_at: string;
}

export interface WhatsappInstance {
  user_id: string;
  instance_name: string;
  status: string;
  qr_code: string | null;
  pairing_code: string | null;
  connected_phone: string | null;
  last_error: string | null;
  connected_at: string | null;
  updated_at: string;
}

export interface KnowledgeItem {
  id: string;
  content: string;
  source: string | null;
  created_at: string;
}

export async function getBotConfig(): Promise<BotConfig> {
  const { data, error } = await supabase.from('crm_bot_config').select('*').eq('id', true).single();
  if (error) throw new Error(`[crmService] getBotConfig: ${error.message}`);
  return data as BotConfig;
}

export async function saveBotConfig(patch: Partial<Pick<BotConfig, 'bot_enabled' | 'custom_prompt'>>): Promise<BotConfig> {
  const { data, error } = await supabase
    .from('crm_bot_config')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', true)
    .select('*')
    .single();
  if (error) throw new Error(`[crmService] saveBotConfig: ${error.message}`);
  return data as BotConfig;
}

export async function listKnowledge(): Promise<KnowledgeItem[]> {
  const { data, error } = await supabase
    .from('crm_bot_knowledge')
    .select('id, content, source, created_at')
    .order('created_at', { ascending: false });
  if (error) throw new Error(`[crmService] listKnowledge: ${error.message}`);
  return data as KnowledgeItem[];
}

export async function deleteKnowledge(id: string): Promise<void> {
  const { error } = await supabase.from('crm_bot_knowledge').delete().eq('id', id);
  if (error) throw new Error(`[crmService] deleteKnowledge: ${error.message}`);
}

export async function addKnowledge(content: string, source?: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke('bot-knowledge-upsert', { body: { content, source } });
  if (error) throw error;
  if (!data?.ok) throw new Error(data?.message || 'No se pudo agregar el conocimiento.');
}

export async function getWhatsappInstance(): Promise<WhatsappInstance | null> {
  const { data, error } = await (supabase as any)
    .from('crm_whatsapp_instances')
    .select('*')
    .maybeSingle();
  if (error) throw new Error(`[crmService] getWhatsappInstance: ${error.message}`);
  return data as WhatsappInstance | null;
}

export async function connectWhatsappInstance(): Promise<WhatsappInstance> {
  const { data, error } = await supabase.functions.invoke('whatsapp-connect', { body: {} });
  if (error) throw error;
  if (!data?.ok) throw new Error(data?.message || 'No se pudo generar el QR de WhatsApp.');
  return data.instance as WhatsappInstance;
}

export async function sendWhatsapp(oportunidadId: string, text: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke('whatsapp-send', { body: { oportunidad_id: oportunidadId, text } });
  if (error) throw error;
  if (!data?.ok) throw new Error(data?.message || 'No se pudo enviar el mensaje de WhatsApp.');
}

// ============================================================
// Reseñas (escaneo de Gmail)
// ============================================================
export interface Resena {
  id: string;
  plataforma: string;
  calificacion: number | null;
  texto: string | null;
  resenador: string | null;
  link: string | null;
  respondida: boolean;
  email_subject: string | null;
  email_from: string | null;
  detectada_en: string;
}

export interface ReviewSource {
  id: string;
  plataforma: string;
  nombre: string;
  profile_url: string;
  gmail_query: string | null;
  enabled: boolean;
  last_scanned_at: string | null;
  created_at: string;
  updated_at: string;
}

export async function listReviewSources(): Promise<ReviewSource[]> {
  const { data, error } = await (supabase as any)
    .from('crm_review_sources')
    .select('*')
    .order('plataforma')
    .order('nombre');
  if (error) throw new Error(`[crmService] listReviewSources: ${error.message}`);
  return data as ReviewSource[];
}

export async function upsertReviewSource(source: Partial<ReviewSource> & Pick<ReviewSource, 'plataforma' | 'nombre' | 'profile_url'>): Promise<ReviewSource> {
  const { data, error } = await (supabase as any)
    .from('crm_review_sources')
    .upsert({ ...source, updated_at: new Date().toISOString() })
    .select('*')
    .single();
  if (error) throw new Error(`[crmService] upsertReviewSource: ${error.message}`);
  return data as ReviewSource;
}

export async function deleteReviewSource(id: string): Promise<void> {
  const { error } = await (supabase as any).from('crm_review_sources').delete().eq('id', id);
  if (error) throw new Error(`[crmService] deleteReviewSource: ${error.message}`);
}

export async function listResenas(): Promise<Resena[]> {
  const { data, error } = await (supabase as any)
    .from('crm_resenas')
    .select('*')
    .order('detectada_en', { ascending: false });
  if (error) throw new Error(`[crmService] listResenas: ${error.message}`);
  return data as Resena[];
}

export async function scanResenas(days = 30): Promise<{ inserted: number; scanned: number; already_saved: number; skipped: number }> {
  const accessToken = getAccessToken();
  if (!accessToken) throw new Error('No hay token de Google. Reconecta Google Workspace (incluye permiso Gmail).');
  const { data, error } = await supabase.functions.invoke('reviews-scan', { body: { access_token: accessToken, days } });
  if (error) throw error;
  if (!data?.ok) throw new Error(data?.message || 'No se pudo escanear.');
  return data;
}

export async function markResenaRespondida(id: string, respondida: boolean): Promise<void> {
  const { error } = await (supabase as any).from('crm_resenas').update({ respondida }).eq('id', id);
  if (error) throw new Error(`[crmService] markResenaRespondida: ${error.message}`);
}
