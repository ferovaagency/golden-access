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

function localPlannerTimeToIso(localValue: string, timeZone: string) {
  const [datePart, timePart = '00:00:00'] = localValue.split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hour, minute, second = 0] = timePart.split(':').map(Number);
  const wallClockAsUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  const offsetAt = (instant: Date) => {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
      .formatToParts(instant).reduce<Record<string, string>>((result, part) => ({ ...result, [part.type]: part.value }), {});
    return (Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second)) - instant.getTime()) / 60_000;
  };
  let instant = new Date(wallClockAsUtc - offsetAt(new Date(wallClockAsUtc)) * 60_000);
  instant = new Date(wallClockAsUtc - offsetAt(instant) * 60_000);
  return instant.toISOString();
}

function nextDate(date: string) {
  const [year, month, day] = date.split('-').map(Number);
  const value = new Date(Date.UTC(year, month - 1, day + 1));
  return value.toISOString().slice(0, 10);
}

function zonedParts(value: Date, timeZone: string) {
  return new Intl.DateTimeFormat('en-CA', { timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
    .formatToParts(value).reduce<Record<string, string>>((result, part) => ({ ...result, [part.type]: part.value }), {});
}

function zonedDate(value: Date, timeZone: string) {
  const p = zonedParts(value, timeZone);
  return `${p.year}-${p.month}-${p.day}`;
}

function zonedMinute(value: Date, timeZone: string) {
  const p = zonedParts(value, timeZone);
  return Number(p.hour) * 60 + Number(p.minute);
}

function timeToMinute(value: string | null | undefined, fallback: number) {
  const match = value?.match(/^(\d{1,2}):(\d{2})$/);
  return match ? Math.max(0, Math.min(1439, Number(match[1]) * 60 + Number(match[2]))) : fallback;
}

export const plannerService = {
  async getTimeZone(): Promise<string> {
    const { data, error } = await anyDb().from('business_profile').select('zona_horaria').maybeSingle();
    if (error) { log.error(error); return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Bogota'; }
    return data?.zona_horaria || Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Bogota';
  },
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
    const timeZone = await this.getTimeZone();
    // planner_blocks is stored in UTC. Convert the user's local calendar day
    // to UTC boundaries so a Bogotá day never starts at 19:00 the day before.
    const start = localPlannerTimeToIso(`${date}T00:00:00`, timeZone);
    const end = localPlannerTimeToIso(`${nextDate(date)}T00:00:00`, timeZone);
    const { data, error } = await anyDb().from('planner_blocks').select('*').gte('starts_at', start).lt('starts_at', end).order('starts_at');
    if (error) { log.error(error); return []; }
    return data || [];
  },
  async listBlocksRange(startDate: string, endDate: string): Promise<PlannerBlock[]> {
    const timeZone = await this.getTimeZone();
    const start = localPlannerTimeToIso(`${startDate}T00:00:00`, timeZone);
    const end = localPlannerTimeToIso(`${endDate}T00:00:00`, timeZone);
    const { data, error } = await anyDb().from('planner_blocks').select('*')
      .gte('starts_at', start).lt('starts_at', end).order('starts_at');
    if (error) { log.error(error); return []; }
    return data || [];
  },
  async createBlock(input: CreatePlannerBlockInput): Promise<void> {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!user) throw new Error('Debes iniciar sesión para crear un bloque.');

    const timeZone = await this.getTimeZone();
    const { error } = await anyDb().from('planner_blocks').insert({
      user_id: user.id,
      title: input.title.trim(),
      starts_at: localPlannerTimeToIso(input.starts_at, timeZone),
      ends_at: localPlannerTimeToIso(input.ends_at, timeZone),
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
    // Keep day scheduling available even when Lovable has an older deployed
    // Edge Function. All writes remain protected by the user's existing RLS.
    const timeZone = await this.getTimeZone();
    const today = zonedDate(new Date(), timeZone);
    const targetDate = !date || date < today ? today : date;
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return { data: null, error: authError || new Error('Debes iniciar sesión.') };
    const { data: profile, error: profileError } = await anyDb().from('business_profile').select('horario_inicio,horario_fin,dias_laborales').maybeSingle();
    if (profileError) return { data: null, error: profileError };
    const weekday = new Date(`${targetDate}T12:00:00`).getDay();
    const workdays = Array.isArray(profile?.dias_laborales) && profile.dias_laborales.length ? profile.dias_laborales : [1, 2, 3, 4, 5];
    if (!workdays.includes(weekday)) return { data: { ok: true, preview: !apply, blocks: [], summary: 'No es un día laboral según tu configuración.' }, error: null };
    const start = timeToMinute(profile?.horario_inicio, 8 * 60);
    const end = Math.max(start + 15, timeToMinute(profile?.horario_fin, 18 * 60));
    const [{ data: tasks, error: tasksError }, blocks] = await Promise.all([
      anyDb().from('planner_tasks').select('*').in('status', ['backlog', 'scheduled', 'postponed']).order('deadline', { ascending: true, nullsFirst: false }).limit(40),
      this.listBlocks(targetDate),
    ]);
    if (tasksError) return { data: null, error: tasksError };
    const nowStart = targetDate === today ? Math.ceil(zonedMinute(new Date(), timeZone) / 15) * 15 : start;
    const busy = [...(blocks || []).filter((b: PlannerBlock) => b.protected || b.source === 'google' || b.source === 'external'), ...busyBlocks]
      .map((b: any) => [zonedMinute(new Date(b.starts_at), timeZone), zonedMinute(new Date(b.ends_at), timeZone)] as [number, number]);
    const overlaps = (a: number, b: number) => busy.some(([x, y]) => a < y && b > x);
    const ordered = [...(tasks || [])].sort((a: PlannerTask, b: PlannerTask) => ({ urgent: 0, high: 1, medium: 2, low: 3 }[a.priority] - ({ urgent: 0, high: 1, medium: 2, low: 3 }[b.priority])));
    const planned: any[] = [];
    let cursor = Math.max(start, nowStart);
    for (const task of ordered) {
      const duration = Math.max(15, Math.min(120, Math.ceil(Number(task.estimated_minutes || 30) / 15) * 15));
      while (cursor + duration <= end && overlaps(cursor, cursor + duration)) cursor += 15;
      if (cursor + duration > end) break;
      planned.push({ user_id: user.id, title: task.title, category: task.category, starts_at: localPlannerTimeToIso(`${targetDate}T${String(Math.floor(cursor / 60)).padStart(2, '0')}:${String(cursor % 60).padStart(2, '0')}:00`, timeZone), ends_at: localPlannerTimeToIso(`${targetDate}T${String(Math.floor((cursor + duration) / 60)).padStart(2, '0')}:${String((cursor + duration) % 60).padStart(2, '0')}:00`, timeZone), task_ids: [task.id], source: 'planner-rules', notes: 'Programado automáticamente según horario laboral y espacios libres.', protected: false });
      busy.push([cursor, cursor + duration]); cursor += duration;
    }
    if (apply) {
      const dayStart = localPlannerTimeToIso(`${targetDate}T00:00:00`, timeZone), dayEnd = localPlannerTimeToIso(`${nextDate(targetDate)}T00:00:00`, timeZone);
      const { error: deleteError } = await anyDb().from('planner_blocks').delete().in('source', ['ai', 'planner-rules']).gte('starts_at', dayStart).lt('starts_at', dayEnd);
      if (deleteError) return { data: null, error: deleteError };
      if (planned.length) { const { error: insertError } = await anyDb().from('planner_blocks').insert(planned); if (insertError) return { data: null, error: insertError }; await anyDb().from('planner_tasks').update({ status: 'scheduled', scheduled_for: targetDate }).in('id', planned.flatMap((b) => b.task_ids)); }
    }
    return { data: { ok: true, preview: !apply, blocks: planned, summary: `${planned.length} bloque(s) dentro de tu horario laboral.` }, error: null };
  },
  async regenerateInsights() {
    return invokeAi<{ ok: boolean; insights: any[] }>({ functionName: 'planner-insights', body: { kind: 'insights' } });
  },
  async regenerateBriefing(kind: 'morning' | 'evening' = 'morning') {
    return invokeAi<{ ok: boolean; briefing: PlannerBriefing }>({ functionName: 'planner-insights', body: { kind } });
  },
};
