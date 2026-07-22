// Client-side facade for the Smart Planner intelligence layer.
// Reuses supabase client + the shared aiClient helper — never talks to a
// provider directly. All heavy lifting (classification, planning, insights)
// runs in edge functions.
import { supabase } from '../integrations/supabase/client';
import { invokeAi } from './ai/aiClient';
import { logger } from './logger';
import { logSuggestion } from './auditLogService';

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
  financial_impact: number;
  client_impact: number;
  risk_score: number;
  execution_ease: number;
  dependency_task_ids: string[];
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
  recurrence_days: number[];
  recurrence_until: string | null;
  sync_to_google_calendar: boolean;
  google_calendar_event_id: string | null;
}

export interface PlannerClient { id: string; nombre: string; }

export interface PlannerBlock {
  id: string;
  title: string;
  category: PlannerCategory;
  starts_at: string;
  ends_at: string;
  task_ids: string[];
  /** Único flag de protección. Cuando es true, el planificador IA no lo mueve. */
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

export interface PlannerBusyBlock { starts_at: string; ends_at: string; title?: string; }

export interface CreatePlannerBlockInput {
  title: string;
  starts_at: string;
  ends_at: string;
  category?: PlannerCategory;
  protected?: boolean;
  notes?: string | null;
}

export interface UpdatePlannerTaskInput {
  title: string;
  category: PlannerCategory;
  priority: PlannerPriority;
  financial_impact: number;
  client_impact: number;
  risk_score: number;
  execution_ease: number;
  dependency_task_ids: string[];
  client_ref: string | null;
  deadline: string | null;
  estimated_minutes: number;
  actual_minutes: number | null;
  scheduled_for: string | null;
  schedule_time?: string | null;
  protected?: boolean;
  recurrence_days: number[];
  recurrence_until: string | null;
  sync_to_google_calendar: boolean;
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
      protected: input.protected ?? true,
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
    const { error: taskError } = await anyDb()
      .from('planner_tasks')
      .update({ status: 'done', completed_at: new Date().toISOString(), actual_minutes: actualMinutes ?? null })
      .eq('id', id);
    if (taskError) throw taskError;

    // A task can remain referenced by an already-created agenda block. Without
    // removing that reference, the check marks it done in the database but it
    // continues to be rendered as pending in "Tu agenda" until a re-plan.
    const { data: linkedBlocks, error: blocksError } = await anyDb()
      .from('planner_blocks')
      .select('id, task_ids, source')
      .contains('task_ids', [id]);
    if (blocksError) throw blocksError;

    await Promise.all((linkedBlocks || []).map((block: { id: string; task_ids: string[]; source: string }) => {
      const remainingTaskIds = (block.task_ids || []).filter((taskId) => taskId !== id);
      // Automatically generated blocks only represent tasks, so an empty one
      // should disappear. A manual/protected block is a real commitment and
      // remains on the agenda even if its linked task is completed.
      if (remainingTaskIds.length === 0 && ['ai', 'planner-rules', 'task', 'recurrence'].includes(block.source)) {
        return anyDb().from('planner_blocks').delete().eq('id', block.id);
      }
      return anyDb().from('planner_blocks').update({ task_ids: remainingTaskIds }).eq('id', block.id);
    }));
  },
  async listClients(): Promise<PlannerClient[]> {
    const { data, error } = await anyDb().from('finance_clientes').select('id, nombre').order('nombre');
    if (error) { log.error(error); return []; }
    return data || [];
  },
  async updateTask(id: string, input: UpdatePlannerTaskInput): Promise<{ synced: boolean; message: string }> {
    const { data, error } = await supabase.functions.invoke('planner-save-task', { body: { id, ...input } });
    if (error) throw error;
    if (!data?.ok) throw new Error(data?.message || 'No fue posible guardar la tarea.');
    return data.calendar || { synced: false, message: 'Tarea guardada.' };
  },
  async postponeTask(id: string) {
    const { data } = await anyDb().from('planner_tasks').select('postponed_count').eq('id', id).maybeSingle();
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
    await anyDb().from('planner_tasks').update({ status: 'postponed', scheduled_for: tomorrow.toISOString().slice(0, 10), postponed_count: (data?.postponed_count ?? 0) + 1 }).eq('id', id);
  },
  async deleteTask(id: string) { await anyDb().from('planner_tasks').delete().eq('id', id); },
  /**
   * Punto #4 pendiente del backlog: si una tarea quedó asignada a un día que
   * ya pasó y nunca se completó, se reprograma sola para hoy (no se pierde
   * silenciosamente). Solo mueve la fecha -- convertirla en un bloque del
   * horario sigue requiriendo "Reorganizar mi día" (acción explícita del
   * usuario), tal como ya funciona para el resto del planner.
   */
  async rescheduleOverdueTasks(todayDate: string): Promise<string[]> {
    const { data: overdue, error } = await anyDb()
      .from('planner_tasks')
      .select('id, title, postponed_count, scheduled_for')
      .eq('status', 'scheduled')
      .lt('scheduled_for', todayDate);
    if (error) { log.error(error); return []; }
    if (!overdue || !overdue.length) return [];

    await Promise.all(overdue.map((t: any) =>
      anyDb().from('planner_tasks').update({
        scheduled_for: todayDate,
        postponed_count: (t.postponed_count ?? 0) + 1,
      }).eq('id', t.id)
    ));

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await Promise.all(overdue.map((t: any) => logSuggestion(user.id, {
        entityType: 'planner_task',
        entityId: t.id,
        actor: 'system',
        action: 'reprogramado_automatico',
        description: `"${t.title}" no se completó en su fecha (${t.scheduled_for}) y se reprogramó automáticamente para hoy.`,
        previousValue: { scheduled_for: t.scheduled_for },
        newValue: { scheduled_for: todayDate },
        autoApplied: true,
      })));
    }

    return overdue.map((t: any) => t.id as string);
  },
  async deleteInboxEntry(id: string) { await anyDb().from('planner_inbox').delete().eq('id', id); },

  async classify(text: string) {
    return invokeAi<{ ok: boolean; results: any[] }>({ functionName: 'planner-classify', body: { text } });
  },
  async calendarBusyBlocks(date: string): Promise<PlannerBusyBlock[]> {
    const { getAccessToken } = await import('./supabase');
    const accessToken = getAccessToken();
    if (!accessToken) return [];
    const { data, error } = await supabase.functions.invoke('planner-calendar-busy', { body: { date, access_token: accessToken } });
    if (error || !data?.ok) return [];
    return data.blocks || [];
  },
  async planDay(date?: string, apply = false, busyBlocks: PlannerBusyBlock[] = []) {
    return invokeAi<PlannerPlanResult>({ functionName: 'planner-plan-day', body: { date, apply, busy_blocks: busyBlocks } });
  },
  async regenerateInsights() {
    return invokeAi<{ ok: boolean; insights: any[] }>({ functionName: 'planner-insights', body: { kind: 'insights' } });
  },
  async regenerateBriefing(kind: 'morning' | 'evening' = 'morning') {
    return invokeAi<{ ok: boolean; briefing: PlannerBriefing }>({ functionName: 'planner-insights', body: { kind } });
  },
};
