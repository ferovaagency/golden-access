// Business Intelligence service — central client-side facade for the health
// score and blind-spots detector. All React modules must go through this file
// instead of calling edge functions directly.

import { supabase } from '../integrations/supabase/client';
import { invokeAi } from './ai/aiClient';
import { logger } from './logger';

const log = logger.child('bi');

export interface HealthSubScore { label: string; score: number; weight: number; note: string }
export interface HealthReason { kind: 'weak' | 'strong'; label: string; score: number; note: string }

export interface HealthSnapshot {
  id: string;
  snapshot_date: string;
  score: number;
  previous_score: number | null;
  delta: number;
  sub_scores: HealthSubScore[];
  top_reasons: HealthReason[];
  narrative: string | null;
  computed_at: string;
}

export type BlindSpotUrgency = 'critical' | 'high' | 'medium' | 'low';
export type BlindSpotCategory =
  | 'client_at_risk' | 'revenue_concentration' | 'cash_risk' | 'late_invoice'
  | 'project_hours_overrun' | 'low_margin_project' | 'employee_overload'
  | 'unused_capacity' | 'no_followup' | 'postponed_task' | 'marketing_inactive'
  | 'low_sales_activity' | 'bottleneck' | 'opportunity';

export interface BlindSpot {
  id: string;
  category: BlindSpotCategory;
  urgency: BlindSpotUrgency;
  title: string;
  why: string;
  impact: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  action_route: string | null;
  metric_value: number | null;
  metric_label: string | null;
  detected_at: string;
  dismissed_at: string | null;
  resolved_at: string | null;
}

export async function fetchLatestHealth(userId: string): Promise<HealthSnapshot | null> {
  const { data, error } = await supabase
    .from('business_health_snapshots' as any)
    .select('*')
    .eq('user_id', userId)
    .order('snapshot_date', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) { log.error(error, { op: 'fetchLatestHealth' }); return null; }
  return (data as any) || null;
}

export async function fetchOpenBlindSpots(userId: string): Promise<BlindSpot[]> {
  const { data, error } = await supabase
    .from('business_blindspots' as any)
    .select('*')
    .eq('user_id', userId)
    .is('dismissed_at', null)
    .is('resolved_at', null)
    .order('detected_at', { ascending: false });
  if (error) { log.error(error, { op: 'fetchOpenBlindSpots' }); return []; }
  return (data || []) as any;
}

export async function recomputeHealth(): Promise<HealthSnapshot | null> {
  const { data, error } = await invokeAi<{ ok: boolean; snapshot?: HealthSnapshot; message?: string }>({
    functionName: 'bi-compute-health',
    body: {},
  });
  if (error) throw error;
  if (!data?.ok) throw new Error(data?.message || 'No se pudo calcular el health score');
  return data.snapshot || null;
}

export async function refreshBlindSpots(): Promise<BlindSpot[]> {
  const { data, error } = await invokeAi<{ ok: boolean; blindspots?: BlindSpot[]; message?: string }>({
    functionName: 'bi-detect-blindspots',
    body: {},
  });
  if (error) throw error;
  if (!data?.ok) throw new Error(data?.message || 'No se pudieron detectar puntos ciegos');
  return data.blindspots || [];
}

export async function dismissBlindSpot(id: string): Promise<void> {
  const { error } = await supabase
    .from('business_blindspots' as any)
    .update({ dismissed_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function resolveBlindSpot(id: string): Promise<void> {
  const { error } = await supabase
    .from('business_blindspots' as any)
    .update({ resolved_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export const urgencyRank: Record<BlindSpotUrgency, number> = { critical: 0, high: 1, medium: 2, low: 3 };
