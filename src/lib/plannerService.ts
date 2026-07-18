// Client-side facade for the Smart Planner intelligence layer.
// Reuses supabase client + the shared aiClient helper — never talks to a
// provider directly. All heavy lifting (classification, planning, insights)
// runs in edge functions.
import { supabase } from '../integrations/supabase/client';
import { invokeAi } from './ai/aiClient';
import { logger } from './logger';

const log = logger.child('planner');

export type PlannerCategory = 'deep_work' | 'meetings' | 'admin' | 'creative' | 'calls' | 'learning' | 'personal' | 'breaks';
export type PlannerPriority = 'low' | 'medium' | 'high' | 'urgent';
export type PlannerEnergy = 'low' | 'medium' | 'high';
export type PlannerTaskStatus = 'backlog' | 'scheduled' | 'in_progress' | 'done' | 'postponed' | 'cancelled';

export interface PlannerInbox {
  id: string;
  raw_text: string;
  detected_type: string | null;
  detected_priority: PlannerPriority | null;
  detected_energy: PlannerEnergy | null;
  detected_category: PlannerCategory | null;
  detected_duration_min: number | null;
  detected_deadline: string | null;
  detected_client: string | null;
  detected_project: string | null;
  ai_confidence: number | null;
  ai_reasoning: string | null;
  processed: boolean;
  task_id: string | null;
  created_at: string;
}

export interface PlannerTask {
  id: string;
  title: string;
  description: string | null;
  category: PlannerCategory;
  priority: PlannerPriority;
  energy_required: PlannerEnergy;
  estimated_minutes: number;
  actual_minutes: number | null;
  deadline: string | null;
  scheduled_for: string | null;
  status: PlannerTaskStatus;
  project_ref: string | null;
  client_ref: string | null;
  ai_notes: string | null;
  completed_at: string | null;
  postponed_count: number;
}

export interface PlannerBlock {
  id: string;
  title: string;
  category: PlannerCategory;
  starts_at: string;
  ends_at: string;
  task_ids: string[];
  is_locked: boolean;
  protected: boolean;
  source: string;
  notes: string | null;
}

export interface PlannerInsight {
  id: string;
  kind: string;
  severity: 'info' | 'warn' | 'risk' | 'opportunity';
  title: string;
  body: string;
  action_hint: string | null;
  action_route: string | null;
  dismissed: boolean;
  created_at: string;
}

export interface PlannerBriefing {
  headline: string;
  bullets: string[];
  suggested_focus: string;
  estimated_workload_minutes: number;
}

export interface PlannerPlanResult {
  ok: boolean;
  preview: boolean;
  summary?: string;
  blocks: PlannerBlock[];
}

export interface CreatePlannerBlockInput {
  title: string;
  starts_at: string;
  ends_at: string;
  category?: PlannerCategory;
  is_locked?: boolean;
  notes?: string | null;
}

const anyDb = () => supabase as any;

export const plannerService = {
  async listInbox(): Promise<PlannerInbox[]> {
    const { data, error } = await anyDb().from('planner_inbox').select('*').order('created_at', { ascending: false }).limit(50);
    if (error) { log.error(error); return []; }
    return data || [];
  },
  async listTasks(): Promise<PlannerTask[]> {
    const { data, error } = await anyDb().from('planner_tasks').select('*').order('created_at', { ascending: false }).limit(200);
    if (error) { log.error(error); return []; }
    return data || [];
  },
  async listBlocks(date: string): Promise<PlannerBlock[]> {
    const start = `${date}T00:00:00`;
    const end = `${date}T23:59:59`;
    const { data, error } = await anyDb().from('planner_blocks').select('*').gte('starts_at', start).lte('starts_at', end).order('starts_at');
    if (error) { log.error(error); return []; }
    return data || [];
  },
  async createBlock(input: CreatePlannerBlockInput): Promise<void> {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!user) throw new Error('Debes iniciar sesión para crear un bloque.');

    const { error } = await anyDb().from('planner_blocks').insert({
      user_id: user.id,
      title: input.title.trim(),
      starts_at: input.starts_at,
      ends_at: input.ends_at,
      category: input.category ?? 'meetings',
      is_locked: input.is_locked ?? true,
      notes: input.notes?.trim() || null,
      source: 'manual',
    });
    if (error) throw error;
  },
  async listInsights(): Promise<PlannerInsight[]> {
    const { data, error } = await anyDb().from('planner_insights').select('*').eq('dismissed', false).order('created_at', { ascending: false });
    if (error) { log.error(error); return []; }
    return data || [];
  },
  async loadBriefing(kind: 'morning' | 'evening'): Promise<PlannerBriefing | null> {
    const date = new Date().toISOString().slice(0, 10);
    const { data } = await anyDb().from('planner_briefings').select('payload').eq('kind', kind).eq('briefing_date', date).maybeSingle();
    return (data?.payload as PlannerBriefing) ?? null;
  },
  async dismissInsight(id: string) {
    await anyDb().from('planner_insights').update({ dismissed: true }).eq('id', id);
  },
  async completeTask(id: string, actualMinutes?: number) {
    await anyDb().from('planner_tasks').update({ status: 'done', completed_at: new Date().toISOString(), actual_minutes: actualMinutes ?? null }).eq('id', id);
  },
  async postponeTask(id: string) {
    const { data } = await anyDb().from('planner_tasks').select('postponed_count').eq('id', id).maybeSingle();
    await anyDb().from('planner_tasks').update({ status: 'postponed', postponed_count: (data?.postponed_count ?? 0) + 1 }).eq('id', id);
  },
  async deleteTask(id: string) { await anyDb().from('planner_tasks').delete().eq('id', id); },
  async deleteInboxEntry(id: string) { await anyDb().from('planner_inbox').delete().eq('id', id); },

  async classify(text: string) {
    return invokeAi<{ ok: boolean; results: any[] }>({ functionName: 'planner-classify', body: { text } });
  },
  async planDay(date?: string, apply = false) {
    return invokeAi<PlannerPlanResult>({ functionName: 'planner-plan-day', body: { date, apply } });
  },
  async regenerateInsights() {
    return invokeAi<{ ok: boolean; insights: any[] }>({ functionName: 'planner-insights', body: { kind: 'insights' } });
  },
  async regenerateBriefing(kind: 'morning' | 'evening' = 'morning') {
    return invokeAi<{ ok: boolean; briefing: PlannerBriefing }>({ functionName: 'planner-insights', body: { kind } });
  },
};
