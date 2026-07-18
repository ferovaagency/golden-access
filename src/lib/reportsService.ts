// CEO Reports + Decision Support service.
import { supabase } from '../integrations/supabase/client';
import { invokeAi } from './ai/aiClient';
import { logger } from './logger';

const log = logger.child('reports');

export type ReportPeriod = 'daily' | 'weekly' | 'monthly';

export interface CeoReport {
  id: string;
  period: ReportPeriod;
  period_start: string;
  period_end: string;
  headline: string | null;
  summary_md: string | null;
  wins: string[];
  risks: string[];
  priorities: string[];
  metrics: Record<string, any>;
  health_score: number | null;
  created_at: string;
}

export interface DecisionSimulation {
  id: string;
  question: string;
  scenario_type: string;
  inputs: Record<string, any>;
  result: Record<string, any>;
  recommendation: string | null;
  created_at: string;
}

export async function listReports(userId: string, period?: ReportPeriod, limit = 12): Promise<CeoReport[]> {
  let q = supabase.from('ceo_reports' as any).select('*').eq('user_id', userId).order('period_start', { ascending: false }).limit(limit);
  if (period) q = q.eq('period', period);
  const { data, error } = await q;
  if (error) { log.error(error, { op: 'listReports' }); return []; }
  return (data || []) as any;
}

export async function generateReport(period: ReportPeriod): Promise<CeoReport> {
  const { data, error } = await invokeAi<{ ok: boolean; report?: CeoReport; message?: string }>({
    functionName: 'ceo-report-generate',
    body: { period },
  });
  if (error) throw error;
  if (!data?.ok || !data.report) throw new Error(data?.message || 'No se pudo generar el reporte');
  return data.report;
}

export async function listSimulations(userId: string, limit = 20): Promise<DecisionSimulation[]> {
  const { data, error } = await supabase
    .from('decision_simulations' as any)
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) { log.error(error, { op: 'listSimulations' }); return []; }
  return (data || []) as any;
}

export async function runSimulation(payload: { question: string; scenario_type: string; inputs: Record<string, any> }): Promise<DecisionSimulation> {
  const { data, error } = await invokeAi<{ ok: boolean; simulation?: DecisionSimulation; baseline?: any; message?: string }>({
    functionName: 'decision-simulate',
    body: payload,
  });
  if (error) throw error;
  if (!data?.ok || !data.simulation) throw new Error(data?.message || 'No se pudo simular');
  return data.simulation;
}
