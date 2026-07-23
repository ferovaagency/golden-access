// Aggregate hook for the Smart Planner UI. Loads inbox, tasks, today's blocks
// and insights in one place, and exposes typed actions that map 1:1 to
// plannerService. Components should not touch supabase for planner data.
import { useCallback, useEffect, useRef, useState } from 'react';
import { plannerService, type CreatePlannerBlockInput, type PlannerBlock, type PlannerBriefing, type PlannerClient, type PlannerInbox, type PlannerInsight, type PlannerTask, type UpdatePlannerTaskInput } from '../lib/plannerService';
import { countTodayAutoActions } from '../lib/auditLogService';

function today() { return todayInTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Bogota'); }

function todayInTimeZone(timeZone: string, instant = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(instant)
    .reduce<Record<string, string>>((result, part) => ({ ...result, [part.type]: part.value }), {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function usePlanner() {
  const [inbox, setInbox] = useState<PlannerInbox[]>([]);
  const [tasks, setTasks] = useState<PlannerTask[]>([]);
  const [clients, setClients] = useState<PlannerClient[]>([]);
  const [blocks, setBlocks] = useState<PlannerBlock[]>([]);
  const [insights, setInsights] = useState<PlannerInsight[]>([]);
  const [briefing, setBriefing] = useState<PlannerBriefing | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [date, setDate] = useState<string>(today());
  const [rescheduledCount, setRescheduledCount] = useState(0);
  const [planNotice, setPlanNotice] = useState<string | null>(null);
  const [timeZone, setTimeZone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Bogota');
  const hasAutoPlanned = useRef(false);

  const revealFirstPlannedDay = useCallback((plannedBlocks: Array<{ starts_at: string }> | undefined, zone: string) => {
    const firstBlock = plannedBlocks?.[0];
    if (!firstBlock) return;
    setDate(todayInTimeZone(zone, new Date(firstBlock.starts_at)));
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const zone = await plannerService.getTimeZone();
      const currentDate = todayInTimeZone(zone);
      if (!hasAutoPlanned.current && date === currentDate) {
        hasAutoPlanned.current = true;
        await plannerService.rescheduleOverdueTasks(currentDate);
        // El conteo sale de audit_log para cubrir AMBOS mecanismos: el cron
        // diario del servidor (5:10) y este barrido al abrir el Planner.
        const { data: { user } } = await (await import('../lib/supabase')).supabase.auth.getUser();
        if (user) setRescheduledCount(await countTodayAutoActions(user.id, 'reprogramado_automatico'));
        // Opening the Planner keeps the rolling agenda current. It no longer
        // depends on an overdue transition or on pressing the button.
        const busyBlocks = await plannerService.calendarBusyBlocks(currentDate);
        const { data: plan, error: planError } = await plannerService.planDay(undefined, true, busyBlocks);
        if (planError) setError(planError.message);
        else if (plan) {
          setPlanNotice(plan.summary);
          revealFirstPlannedDay(plan.blocks, zone);
        }
      }
      const [i, t, c, b, ins, br] = await Promise.all([
        plannerService.listInbox(),
        plannerService.listTasks(),
        plannerService.listClients(),
        plannerService.listBlocks(date),
        plannerService.listInsights(),
        plannerService.loadBriefing('morning'),
      ]);
      setInbox(i); setTasks(t); setClients(c); setBlocks(b); setInsights(ins); setBriefing(br); setTimeZone(zone);
    } finally { setLoading(false); }
  }, [date, revealFirstPlannedDay]);

  useEffect(() => { void refresh(); }, [refresh]);

  const classify = useCallback(async (text: string) => {
    if (!text.trim()) return;
    setBusy('classify'); setError(null);
    try {
      const { error: err } = await plannerService.classify(text);
      if (err) setError(err.message);
      // A brain dump is an instruction to free mental space: once its tasks
      // exist, propose the day immediately. Google events are supplied as busy
      // intervals when the user has authorized Calendar; no token is persisted.
      if (!err) {
        const { error: planError } = await plannerService.planDay(undefined, true);
        if (planError) setError(planError.message);
      }
      await refresh();
    } catch (err: any) {
      setError(err?.message || 'No fue posible clasificar las tareas.');
    } finally {
      setBusy(null);
    }
  }, [refresh]);

  const planDay = useCallback(async () => {
    setBusy('plan'); setError(null);
    try {
      // Reorganizar is an operating command, not a draft: the planner applies
      // the best agenda immediately, preserving protected/Calendar blocks.
      const { data: plan, error: err } = await plannerService.planDay(undefined, true);
      if (err) setError(err.message);
      else if (plan) {
        setPlanNotice(plan.summary);
        revealFirstPlannedDay(plan.blocks, timeZone);
      }
      await refresh();
    } catch (err: any) {
      setError(err?.message || 'No fue posible organizar la agenda.');
    } finally {
      setBusy(null);
    }
  }, [refresh, revealFirstPlannedDay, timeZone]);

  const regenerateInsights = useCallback(async () => {
    setBusy('insights'); setError(null);
    const { error: err } = await plannerService.regenerateInsights();
    if (err) setError(err.message);
    await refresh();
    setBusy(null);
  }, [refresh]);

  const regenerateBriefing = useCallback(async (kind: 'morning' | 'evening' = 'morning') => {
    setBusy('briefing'); setError(null);
    const { data, error: err } = await plannerService.regenerateBriefing(kind);
    if (err) setError(err.message);
    if (data?.briefing) setBriefing(data.briefing);
    setBusy(null);
  }, []);

  const completeTask = useCallback(async (id: string) => {
    setBusy('task'); setError(null);
    try {
      await plannerService.completeTask(id);
      await refresh();
    } catch (err: any) {
      setError(err.message || 'No fue posible completar la tarea.');
      throw err;
    } finally {
      setBusy(null);
    }
  }, [refresh]);
  const updateTask = useCallback(async (id: string, input: UpdatePlannerTaskInput) => {
    setBusy('task'); setError(null);
    try { const result = await plannerService.updateTask(id, input); await refresh(); return result; }
    catch (err: any) { setError(err.message || 'No fue posible actualizar la tarea.'); throw err; }
    finally { setBusy(null); }
  }, [refresh]);
  const postponeTask = useCallback(async (id: string) => { await plannerService.postponeTask(id); await refresh(); }, [refresh]);
  const deleteTask = useCallback(async (id: string) => { await plannerService.deleteTask(id); await refresh(); }, [refresh]);
  const createBlock = useCallback(async (input: CreatePlannerBlockInput) => {
    setBusy('block'); setError(null);
    try {
      await plannerService.createBlock(input);
      await refresh();
    } catch (err: any) {
      setError(err.message || 'No fue posible crear el bloque.');
      throw err;
    } finally {
      setBusy(null);
    }
  }, [refresh]);
  const dismissInsight = useCallback(async (id: string) => { await plannerService.dismissInsight(id); setInsights((prev) => prev.filter((i) => i.id !== id)); }, []);

  return {
    inbox, tasks, clients, blocks, insights, briefing, rescheduledCount, planNotice,
    loading, busy, error, date, setDate, timeZone,
    refresh, classify, planDay, regenerateInsights, regenerateBriefing,
    completeTask, updateTask, postponeTask, deleteTask, createBlock, dismissInsight,
  };
}
