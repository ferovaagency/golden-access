import { supabase } from '../integrations/supabase/client';
import type { Json } from '../integrations/supabase/types';

/**
 * Fase 7 del manual (Apendice A.3 + seccion 4.11): "evidencia, confianza y
 * auditoria en cada accion" para sugerencias y automatizaciones de IA.
 * No reemplaza ningun log de negocio existente -- es la bitacora de
 * acciones sugeridas/aplicadas por IA (p.ej. reprogramar una tarea,
 * sugerir un precio), para poder mostrar "por que" y permitir deshacer.
 */

export type AuditActor = 'ai' | 'user' | 'system';
export type AuditStatus = 'sugerido' | 'aplicado' | 'descartado' | 'revertido';

export interface AuditLogEntry {
  id: string;
  entity_type: string;
  entity_id: string | null;
  actor: AuditActor;
  action: string;
  description: string;
  confidence: number | null;
  previous_value: unknown;
  new_value: unknown;
  status: AuditStatus;
  created_at: string;
  resolved_at: string | null;
}

export interface LogSuggestionInput {
  entityType: string;
  entityId?: string | null;
  actor?: AuditActor;
  action: string;
  description: string;
  confidence?: number | null;
  previousValue?: unknown;
  newValue?: unknown;
  /** Si se pasa true, se registra como ya aplicado en vez de "sugerido" pendiente de confirmación. */
  autoApplied?: boolean;
}

export async function logSuggestion(userId: string, input: LogSuggestionInput): Promise<AuditLogEntry | null> {
  const { data, error } = await supabase
    .from('audit_log')
    .insert({
      user_id: userId,
      entity_type: input.entityType,
      entity_id: input.entityId ?? null,
      actor: input.actor ?? 'ai',
      action: input.action,
      description: input.description,
      confidence: input.confidence ?? null,
      previous_value: (input.previousValue ?? null) as Json,
      new_value: (input.newValue ?? null) as Json,
      status: input.autoApplied ? 'aplicado' : 'sugerido',
      resolved_at: input.autoApplied ? new Date().toISOString() : null,
    })
    .select()
    .single();
  if (error) {
    console.error('logSuggestion error', error);
    return null;
  }
  return data as AuditLogEntry;
}

export async function resolveSuggestion(id: string, status: Exclude<AuditStatus, 'sugerido'>): Promise<void> {
  const { error } = await supabase
    .from('audit_log')
    .update({ status, resolved_at: new Date().toISOString() })
    .eq('id', id);
  if (error) console.error('resolveSuggestion error', error);
}

export async function listPendingSuggestions(userId: string, entityType?: string): Promise<AuditLogEntry[]> {
  let query = supabase
    .from('audit_log')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'sugerido')
    .order('created_at', { ascending: false });
  if (entityType) query = query.eq('entity_type', entityType);
  const { data, error } = await query;
  if (error) {
    console.error('listPendingSuggestions error', error);
    return [];
  }
  return (data ?? []) as AuditLogEntry[];
}

/**
 * Cuenta acciones automáticas de hoy (p.ej. tareas reprogramadas por el cron
 * de las 5:10 o por la apertura del Planner) para poder avisarle al usuario
 * sin importar cuál de los dos mecanismos las movió.
 */
export async function countTodayAutoActions(userId: string, action: string): Promise<number> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const { count, error } = await supabase
    .from('audit_log')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('action', action)
    .gte('created_at', start.toISOString());
  if (error) {
    console.error('countTodayAutoActions error', error);
    return 0;
  }
  return count ?? 0;
}

export interface LogCalculationRunInput {
  calculationType: string;
  inputs: Record<string, unknown>;
  outputs: Record<string, unknown>;
  notes?: string[];
}

/** Registra una corrida de calculo significativa (no cada render) para trazabilidad de "por que dio este numero". */
export async function logCalculationRun(userId: string, input: LogCalculationRunInput): Promise<void> {
  const { error } = await supabase.from('calculation_runs').insert({
    user_id: userId,
    calculation_type: input.calculationType,
    inputs: input.inputs as Json,
    outputs: input.outputs as Json,
    notes: input.notes ?? [],
  });
  if (error) console.error('logCalculationRun error', error);
}
