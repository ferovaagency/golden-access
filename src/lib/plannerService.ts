// Client-side facade for the Smart Planner intelligence layer.
// Reuses supabase client + the shared aiClient helper — never talks to a
// provider directly. All heavy lifting (classification, planning, insights)
// runs in edge functions.
import { supabase } from '../integrations/supabase/client';
import { invokeAi } from './ai/aiClient';
import { logger } from './logger';
import { logSuggestion } from './auditLogService';
import { getActiveAccountId } from './activeAccount';
import { plannerDateKey, plannerTaskAvailableDate } from './plannerScheduling';

const log = logger.child('planner');

export type PlannerCategory = 'deep_work' | 'meetings' | 'admin' | 'creative' | 'calls' | 'learning' | 'personal' | 'breaks';

/** Resultado visible del cierre de una tarea: estimado vs. real y si el tiempo llegó a Horas. */
export interface CompleteTaskResult {
  estimatedMinutes: number | null;
  actualMinutes: number | null;
  hourLogged: boolean;
  /** El tiempo se registró, pero sin servicio: hay que asignarlo en Horas. */
  missingService: boolean;
  hourDate: string | null;
}

/**
 * Interpretación de una línea de captura natural todavía sin persistir.
 * La persona confirma o corrige cliente, fecha y duración antes de crearla.
 */
export interface PlannerDraft {
  line: string;
  title: string;
  detected_type: string;
  detected_priority: PlannerPriority;
  detected_energy: PlannerEnergy;
  detected_category: PlannerCategory;
  detected_duration_min: number;
  financial_impact: number;
  client_impact: number;
  risk_score: number;
  execution_ease: number;
  detected_deadline: string | null;
  detected_client: string | null;
  detected_project: string | null;
  client_ref: string | null;
  scheduled_for: string | null;
  reasoning: string;
  confidence: number;
}
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
  started_at: string | null;
  service_ref: string | null;
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
  /** Quién debe hacerla, entre las personas con acceso a esta cuenta. */
  responsable_user_id: string | null;
  /** Quién la creó. Lo llena la base en el INSERT. */
  created_by: string | null;
}

export interface PlannerClient { id: string; nombre: string; }

/** Persona con acceso a la cuenta activa: sirve para elegir responsable. */
export interface AccountPerson { user_id: string; email: string; rol: string; }

/** Tarea abierta de cualquiera de las empresas alcanzables, con su empresa. */
export interface TareaDeEmpresa {
  id: string;
  account_id: string;
  empresa: string;
  title: string;
  status: PlannerTaskStatus;
  priority: PlannerPriority;
  category: PlannerCategory;
  deadline: string | null;
  scheduled_for: string | null;
  estimated_minutes: number | null;
  responsable_user_id: string | null;
  responsable_email: string | null;
}
export interface PlannerServiceOption { id: string; nombre: string; }

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
  /** 0=domingo..6=sábado. Vacío = bloque único (sin repetición). */
  recurrence_days?: number[];
  /** Fecha final de la repetición (YYYY-MM-DD). Null = horizonte por defecto (90 días). */
  recurrence_until?: string | null;
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
  service_ref?: string | null;
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

/**
 * Supabase can return a planner date as either `YYYY-MM-DD` or as a timestamp,
 * depending on the schema version deployed by Lovable. Planner comparisons
 * must always use the calendar-date portion; comparing a timestamp directly
 * with `YYYY-MM-DD` postpones a task by one day and can leave old blocks in
 * the agenda.
 */
function dayOfWeek(date: string) {
  return new Date(`${date}T12:00:00Z`).getUTCDay();
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
    const cuenta = await getActiveAccountId();
    const { data, error } = await anyDb().from('business_profile').select('zona_horaria').eq('user_id', cuenta ?? '').maybeSingle();
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
    // Cuenta activa: un bloque creado dentro de una empresa del holding es de
    // esa empresa, no de quien lo crea.
    const cuenta = await getActiveAccountId();
    if (!cuenta) throw new Error('Debes iniciar sesión para crear un bloque.');
    const user = { id: cuenta };

    const timeZone = await this.getTimeZone();
    const days = (input.recurrence_days || []).filter((d) => d >= 0 && d <= 6);
    const [startDate, startTime = '09:00:00'] = input.starts_at.split('T');
    const endTime = input.ends_at.split('T')[1] || '10:00:00';

    // Fechas concretas donde cae el bloque. Sin recurrencia: solo la fecha dada.
    const dates: string[] = [];
    if (!days.length) {
      dates.push(startDate);
    } else {
      const horizon = input.recurrence_until
        ? new Date(`${input.recurrence_until}T12:00:00`)
        : new Date(`${startDate}T12:00:00`);
      if (!input.recurrence_until) horizon.setDate(horizon.getDate() + 90);
      const cursor = new Date(`${startDate}T12:00:00`);
      // Tope de seguridad para no generar miles de filas por error.
      for (let guard = 0; cursor <= horizon && guard < 400; guard++) {
        if (days.includes(cursor.getDay())) dates.push(cursor.toISOString().slice(0, 10));
        cursor.setDate(cursor.getDate() + 1);
      }
    }
    if (!dates.length) return;

    const rows = dates.map((d) => ({
      user_id: user.id,
      title: input.title.trim(),
      starts_at: localPlannerTimeToIso(`${d}T${startTime}`, timeZone),
      ends_at: localPlannerTimeToIso(`${d}T${endTime}`, timeZone),
      category: input.category ?? 'meetings',
      protected: input.protected ?? true,
      notes: input.notes?.trim() || null,
      source: 'manual',
      recurrence_days: days,
      recurrence_until: input.recurrence_until || null,
    }));
    const { error } = await anyDb().from('planner_blocks').insert(rows);
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
  async completeTask(id: string, actualMinutes?: number): Promise<CompleteTaskResult> {
    const { data: task, error: readError } = await anyDb().from('planner_tasks').select('*').eq('id', id).single();
    if (readError) throw readError;
    // Tiempo medido = lo acumulado en tramos anteriores (pausas) MÁS lo que
    // lleve corriendo el tramo actual. Antes se tomaba sólo el tramo actual,
    // así que pausar y continuar perdía todo lo trabajado antes de la pausa.
    const acumulado = Number(task?.actual_minutes ?? 0);
    const enCurso = task?.started_at
      ? Math.max(1, Math.round((Date.now() - new Date(task.started_at).getTime()) / 60_000))
      : 0;
    const medido = acumulado + enCurso;
    // Si no se cronometró (no hubo "Iniciar") ni se pasó tiempo manual, cae al
    // estimado — así completar una tarea SIEMPRE registra algo en Horas (editable).
    const finalMinutes = actualMinutes ?? (medido > 0 ? medido : task?.estimated_minutes ?? null);
    const { error: taskError } = await anyDb()
      .from('planner_tasks')
      .update({ status: 'done', completed_at: new Date().toISOString(), actual_minutes: finalMinutes })
      .eq('id', id);
    if (taskError) throw taskError;

    const result: CompleteTaskResult = {
      estimatedMinutes: task?.estimated_minutes ?? null,
      actualMinutes: finalMinutes,
      hourLogged: false,
      missingService: false,
      hourDate: null,
    };

    // Basta con que la tarea tenga cliente: el tiempo real es el dato caro de
    // recuperar. Si falta el servicio se guarda igual con `servicio_id` nulo y
    // queda marcado como "sin servicio" en Horas para completarlo después.
    // El upsert hace el cierre idempotente: completar dos veces no duplica.
    if (finalMinutes) {
      // La hora pertenece al día en que la tarea estaba programada, no al día
      // en que se cerró. Se registra SIEMPRE que haya tiempo real; si no hay
      // cliente asignado, queda como interno (cliente_id nulo) y se puede asignar
      // después en Horas — antes se PERDÍA el tiempo si faltaba el cliente.
      const hourDate = (task.scheduled_for as string | null) || new Date().toISOString().slice(0, 10);
      // La cuenta ACTIVA, no la de quien está conectado: dentro de una empresa
      // del holding, escribir con el id propio apunta a la cuenta equivocada y
      // la RLS rechaza la fila — las horas se perdían en silencio.
      const cuenta = await getActiveAccountId();
      if (cuenta) {
        const { error: hourError } = await anyDb().from('finance_horas').upsert({
          id: `planner_${id}`,
          user_id: cuenta,
          fecha: hourDate,
          cliente_id: task.client_ref ?? null,
          servicio_id: task.service_ref ?? null,
          horas: finalMinutes / 60,
          descripcion: `Planner: ${task.title}`,
        }, { onConflict: 'user_id,id' });
        if (hourError) log.error(hourError);
        else {
          result.hourLogged = true;
          result.hourDate = hourDate;
          result.missingService = !task.service_ref;
        }
      }
    }


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

    return result;
  },
  async listClients(): Promise<PlannerClient[]> {
    const { data, error } = await anyDb().from('finance_clientes').select('id, nombre').order('nombre');
    if (error) { log.error(error); return []; }
    return data || [];
  },
  async listServices(): Promise<PlannerServiceOption[]> {
    const { data, error } = await anyDb().from('finance_servicios').select('id, nombre').order('nombre');
    if (error) { log.error(error); return []; }
    return data || [];
  },
  // El cronómetro se guarda en dos campos que ya existían, sin columna nueva:
  //   · `actual_minutes` acumula el tiempo de los tramos ya cerrados;
  //   · `started_at` marca desde cuándo corre el tramo actual.
  // De ahí sale el estado: en curso = in_progress CON started_at; en pausa =
  // in_progress SIN started_at. La interfaz ya distinguía así lo que corre, de
  // modo que una tarea en pausa aparece sola con su botón de reanudar.
  async startTask(id: string) {
    const { error } = await anyDb().from('planner_tasks').update({ status: 'in_progress', started_at: new Date().toISOString() }).eq('id', id);
    if (error) throw error;
  },
  /** Detiene el cronómetro guardando lo corrido. Reanudar es `startTask`. */
  async pauseTask(id: string) {
    const { data: task, error: readError } = await anyDb().from('planner_tasks').select('actual_minutes, started_at').eq('id', id).single();
    if (readError) throw readError;
    const acumulado = Number(task?.actual_minutes ?? 0);
    const enCurso = task?.started_at
      ? Math.max(1, Math.round((Date.now() - new Date(task.started_at).getTime()) / 60_000))
      : 0;
    const { error } = await anyDb()
      .from('planner_tasks')
      .update({ actual_minutes: acumulado + enCurso, started_at: null })
      .eq('id', id);
    if (error) throw error;
  },
  /** Personas con acceso a la cuenta activa (para asignar responsable). */
  async listAccountPeople(): Promise<AccountPerson[]> {
    const { data, error } = await (supabase as any).rpc('list_account_people');
    if (error) { log.error(error); return []; }
    return (data || []) as AccountPerson[];
  },
  async setResponsable(id: string, responsableUserId: string | null) {
    const { error } = await anyDb().from('planner_tasks').update({ responsable_user_id: responsableUserId }).eq('id', id);
    if (error) throw error;
  },
  /**
   * Tareas abiertas de TODAS las empresas alcanzables, con el nombre de cada
   * una. Va por función de base a propósito: desde el navegador la RLS devuelve
   * sólo la cuenta activa —el resto de la aplicación cuenta con eso— y ésta es
   * la excepción explícita y acotada para la vista del holding.
   */
  async listTasksAllCompanies(): Promise<TareaDeEmpresa[]> {
    const { data, error } = await (supabase as any).rpc('planner_tasks_todas_las_empresas');
    if (error) { log.error(error); return []; }
    return (data || []) as TareaDeEmpresa[];
  },
  /** Cambia el estado de una tarea directamente (usado por el kanban al arrastrar). */
  async setStatus(id: string, status: PlannerTaskStatus) {
    const patch: Record<string, unknown> = { status };
    if (status === 'done') patch.completed_at = new Date().toISOString();
    if (status === 'in_progress') patch.started_at = new Date().toISOString();
    const { error } = await anyDb().from('planner_tasks').update(patch).eq('id', id);
    if (error) throw error;
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
  /** Guarda los detalles/contexto de la tarea (para que la IA tenga más información). */
  async updateTaskDescription(id: string, description: string | null) {
    await anyDb().from('planner_tasks').update({ description: description || null }).eq('id', id);
  },
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
      // The server-side rolling job marks missed work as "postponed". Treat
      // every unfinished scheduled state alike, otherwise those tasks never
      // reach the automatic replanner after the first missed day.
      .in('status', ['backlog', 'scheduled', 'postponed'])
      .lt('scheduled_for', todayDate);
    if (error) { log.error(error); return []; }
    if (!overdue || !overdue.length) return [];

    // Generated blocks from the missed date are no longer commitments. Remove
    // their task reference before the rolling plan places the task again, so a
    // calendar week can never show both the old and the new occurrence.
    const overdueIds = new Set(overdue.map((task: any) => task.id));
    const { data: staleBlocks, error: staleBlocksError } = await anyDb()
      .from('planner_blocks')
      .select('id, task_ids, source')
      .in('source', ['ai', 'planner-rules']);
    if (staleBlocksError) log.error(staleBlocksError);
    await Promise.all((staleBlocks || []).flatMap((block: { id: string; task_ids: string[]; source: string }) => {
      const taskIds = block.task_ids || [];
      if (!taskIds.some((id) => overdueIds.has(id))) return [];
      const remainingTaskIds = taskIds.filter((id) => !overdueIds.has(id));
      return remainingTaskIds.length
        ? [anyDb().from('planner_blocks').update({ task_ids: remainingTaskIds }).eq('id', block.id)]
        : [anyDb().from('planner_blocks').delete().eq('id', block.id)];
    }));

    await Promise.all(overdue.map((t: any) =>
      anyDb().from('planner_tasks').update({
        scheduled_for: todayDate,
        status: 'postponed',
        postponed_count: (t.postponed_count ?? 0) + 1,
      }).eq('id', t.id)
    ));

    const cuentaLog = await getActiveAccountId();
    if (cuentaLog) {
      await Promise.all(overdue.map((t: any) => logSuggestion(cuentaLog, {
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
  /** Interpreta el texto sin escribir nada: la UI confirma o corrige antes de persistir. */
  async previewClassify(text: string) {
    return invokeAi<{ ok: boolean; drafts: PlannerDraft[]; clients: PlannerClient[] }>({
      functionName: 'planner-classify',
      body: { text, preview: true },
    });
  },
  /** Materializa los drafts ya confirmados/corregidos por la persona. */
  async commitDrafts(drafts: PlannerDraft[]) {
    return invokeAi<{ ok: boolean; results: any[]; errors?: string[]; message?: string }>({
      functionName: 'planner-classify',
      body: { drafts },
    });
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
    // Reorganize is an operating command, not a view command. Starting from a
    // future date used to leave earlier automatic blocks intact and schedule
    // the same task a second time. The selected date only changes the view;
    // the rolling agenda always starts today.
    const targetDate = today;
    const cuenta = await getActiveAccountId();
    if (!cuenta) return { data: null, error: new Error('Debes iniciar sesión.') };
    const user = { id: cuenta };
    const { data: profile, error: profileError } = await anyDb().from('business_profile').select('horario_inicio,horario_fin,dias_laborales').eq('user_id', cuenta).maybeSingle();
    if (profileError) return { data: null, error: profileError };
    const workdays = Array.isArray(profile?.dias_laborales) && profile.dias_laborales.length ? profile.dias_laborales : [1, 2, 3, 4, 5];
    const start = timeToMinute(profile?.horario_inicio, 8 * 60);
    const end = Math.max(start + 15, timeToMinute(profile?.horario_fin, 18 * 60));
    // A planning horizon of a quarter keeps the upcoming weeks visible while
    // preventing an accidental click from creating an unbounded agenda.
    const maxPlanningDays = 90;
    let rangeEnd = targetDate;
    for (let index = 0; index < maxPlanningDays; index++) rangeEnd = nextDate(rangeEnd);
    const [{ data: tasks, error: tasksError }, existingBlocks] = await Promise.all([
      anyDb().from('planner_tasks').select('*').in('status', ['backlog', 'scheduled', 'postponed']).order('deadline', { ascending: true, nullsFirst: false }).limit(200),
      this.listBlocksRange(targetDate, rangeEnd),
    ]);
    if (tasksError) return { data: null, error: tasksError };
    const fixedTaskIds = new Set((existingBlocks || [])
      .filter((block: PlannerBlock) => ['task', 'recurrence'].includes(block.source))
      .flatMap((block: PlannerBlock) => block.task_ids || []));
    const automaticallyScheduledTaskIds = new Set<string>((existingBlocks || [])
      .filter((block: PlannerBlock) => ['ai', 'planner-rules'].includes(block.source))
      .flatMap((block: PlannerBlock) => (block.task_ids || []) as string[]));
    const ordered = [...(tasks || [])]
      // A recurring task already materializes protected instances, and a task
      // with a manual time must never receive a second automatic block.
      .filter((task: PlannerTask) => !(task.recurrence_days || []).length && !fixedTaskIds.has(task.id))
      .sort((a: PlannerTask, b: PlannerTask) => ({ urgent: 0, high: 1, medium: 2, low: 3 }[a.priority] - ({ urgent: 0, high: 1, medium: 2, low: 3 }[b.priority])));
    const availableFromByTask = new Map(ordered.map((task: PlannerTask) => [task.id, plannerTaskAvailableDate({
      today: targetDate,
      scheduledFor: task.scheduled_for,
      deadline: task.deadline,
      automaticallyScheduled: automaticallyScheduledTaskIds.has(task.id),
    })]));
    const planned: any[] = [];
    const remaining = [...ordered];
    let planningDate = targetDate;
    let checkedDays = 0;

    // The planner must be useful after today's capacity is exhausted: keep
    // placing tasks on the following workdays, never in elapsed hours.
    while (remaining.length && checkedDays < maxPlanningDays) {
      if (workdays.includes(dayOfWeek(planningDate))) {
        // Do not call Google Calendar once per day while merely advancing to
        // a task's future "Programar desde" date. Besides being slow, that
        // produced dozens of avoidable Edge Function errors for one click.
        const hasEligibleTask = remaining.some((task: PlannerTask) => {
          // `scheduled_for` is also updated after an automatic placement. It
          // must not become a permanent "not before" constraint on the next
          // reorganization, otherwise today's agenda stays empty while the
          // same tasks remain stranded in a future automatic block.
          return (availableFromByTask.get(task.id) || targetDate) <= planningDate;
        });
        if (!hasEligibleTask) {
          planningDate = nextDate(planningDate);
          checkedDays += 1;
          continue;
        }
        const calendarBlocks = planningDate === targetDate && busyBlocks.length
          ? busyBlocks
          : await this.calendarBusyBlocks(planningDate);
        const busy = [
          ...(existingBlocks || []).filter((block: PlannerBlock) =>
            zonedDate(new Date(block.starts_at), timeZone) === planningDate
            && (block.protected || block.source === 'google' || block.source === 'external')),
          ...calendarBlocks,
        ].map((block: any) => [zonedMinute(new Date(block.starts_at), timeZone), zonedMinute(new Date(block.ends_at), timeZone)] as [number, number]);
        const overlaps = (from: number, to: number) => busy.some(([busyFrom, busyTo]) => from < busyTo && to > busyFrom);
        let cursor = planningDate === today ? Math.max(start, Math.ceil(zonedMinute(new Date(), timeZone) / 15) * 15) : start;

        for (let index = 0; index < remaining.length;) {
          const task = remaining[index];
          // "Programar desde" is a promise to the user: a task can be due in
          // a month but intentionally held until, for example, two weeks out.
          if ((availableFromByTask.get(task.id) || targetDate) > planningDate) {
            index += 1;
            continue;
          }
          const duration = Math.max(15, Math.min(120, Math.ceil(Number(task.estimated_minutes || 30) / 15) * 15));
          while (cursor + duration <= end && overlaps(cursor, cursor + duration)) cursor += 15;
          if (cursor + duration > end) break;
          const startsAt = localPlannerTimeToIso(`${planningDate}T${String(Math.floor(cursor / 60)).padStart(2, '0')}:${String(cursor % 60).padStart(2, '0')}:00`, timeZone);
          const endsAt = localPlannerTimeToIso(`${planningDate}T${String(Math.floor((cursor + duration) / 60)).padStart(2, '0')}:${String((cursor + duration) % 60).padStart(2, '0')}:00`, timeZone);
          planned.push({ user_id: user.id, title: task.title, category: task.category, starts_at: startsAt, ends_at: endsAt, task_ids: [task.id], source: 'planner-rules', notes: 'Programado automáticamente según horario laboral, zona horaria y espacios libres.', protected: false });
          busy.push([cursor, cursor + duration]);
          cursor += duration;
          remaining.splice(index, 1);
        }
      }
      planningDate = nextDate(planningDate);
      checkedDays += 1;
    }
    if (apply) {
      const rebuildTaskIds = (tasks || [])
        .filter((task: PlannerTask) => {
          const availableFrom = plannerDateKey(task.scheduled_for);
          return !availableFrom || availableFrom <= rangeEnd;
        })
        .map((task: PlannerTask) => task.id);
      // A rolling plan is rebuilt as a whole. Delete every old automatic
      // occurrence for the open tasks in its horizon, including stale blocks
      // in past days, before inserting the one authoritative occurrence.
      if (rebuildTaskIds.length) {
        const rebuildSet = new Set(rebuildTaskIds);
        const { data: generatedBlocks, error: generatedError } = await anyDb()
          .from('planner_blocks')
          .select('id, task_ids, source, protected, starts_at')
          .in('source', ['ai', 'planner-rules', 'task']);
        if (generatedError) return { data: null, error: generatedError };

        // Filter client-side for compatibility with older Lovable schemas
        // where task_ids was exposed inconsistently and PostgREST `overlaps`
        // rejected an otherwise valid delete.
        const staleIds = (generatedBlocks || [])
          .filter((block: { id: string; task_ids: string[] | null; source: string; protected: boolean; starts_at: string }) => {
            const belongsToRebuild = (block.task_ids || []).some((taskId) => rebuildSet.has(taskId));
            const generated = ['ai', 'planner-rules'].includes(block.source);
            const missedManualSlot = block.source === 'task'
              && !block.protected
              && zonedDate(new Date(block.starts_at), timeZone) < targetDate;
            return belongsToRebuild && (generated || missedManualSlot);
          })
          .map((block: { id: string }) => block.id);
        if (staleIds.length) {
          const { error: deleteError } = await anyDb().from('planner_blocks').delete().in('id', staleIds);
          if (deleteError) return { data: null, error: deleteError };
        }
      }
      if (planned.length) {
        const { error: insertError } = await anyDb().from('planner_blocks').insert(planned);
        if (insertError) return { data: null, error: insertError };
        const updates = await Promise.all(planned.map((block) => anyDb().from('planner_tasks').update({ status: 'scheduled', scheduled_for: zonedDate(new Date(block.starts_at), timeZone) }).eq('id', block.task_ids[0])));
        const updateError = updates.find((result: any) => result.error)?.error;
        if (updateError) return { data: null, error: updateError };
      }
    }
    const endLabel = planned.length ? zonedDate(new Date(planned[planned.length - 1].starts_at), timeZone) : targetDate;
    const overflow = remaining.length ? ` ${remaining.length} tarea(s) no cupieron en los próximos ${maxPlanningDays} días.` : '';
    return { data: { ok: true, preview: !apply, blocks: planned, summary: `${planned.length} bloque(s) programados desde ${targetDate} hasta ${endLabel}.${overflow}` }, error: null };
  },
  async regenerateInsights() {
    return invokeAi<{ ok: boolean; insights: any[] }>({ functionName: 'planner-insights', body: { kind: 'insights' } });
  },
  async regenerateBriefing(kind: 'morning' | 'evening' = 'morning') {
    return invokeAi<{ ok: boolean; briefing: PlannerBriefing }>({ functionName: 'planner-insights', body: { kind } });
  },
};
