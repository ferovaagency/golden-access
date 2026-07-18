// Aggregate hook for the Smart Planner UI. Loads inbox, tasks, today's blocks
// and insights in one place, and exposes typed actions that map 1:1 to
// plannerService. Components should not touch supabase for planner data.
import { useCallback, useEffect, useState } from 'react';
import { plannerService, type CreatePlannerBlockInput, type PlannerBlock, type PlannerBriefing, type PlannerInbox, type PlannerInsight, type PlannerPlanResult, type PlannerTask } from '../lib/plannerService';

function today() { return new Date().toISOString().slice(0, 10); }

export function usePlanner() {
  const [inbox, setInbox] = useState<PlannerInbox[]>([]);
  const [tasks, setTasks] = useState<PlannerTask[]>([]);
  const [blocks, setBlocks] = useState<PlannerBlock[]>([]);
  const [insights, setInsights] = useState<PlannerInsight[]>([]);
  const [briefing, setBriefing] = useState<PlannerBriefing | null>(null);
  const [planPreview, setPlanPreview] = useState<PlannerPlanResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [date, setDate] = useState<string>(today());

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [i, t, b, ins, br] = await Promise.all([
        plannerService.listInbox(),
        plannerService.listTasks(),
        plannerService.listBlocks(date),
        plannerService.listInsights(),
        plannerService.loadBriefing('morning'),
      ]);
      setInbox(i); setTasks(t); setBlocks(b); setInsights(ins); setBriefing(br);
    } finally { setLoading(false); }
  }, [date]);

  useEffect(() => { void refresh(); }, [refresh]);

  const classify = useCallback(async (text: string) => {
    if (!text.trim()) return;
    setBusy('classify'); setError(null);
    const { error: err } = await plannerService.classify(text);
    if (err) setError(err.message);
    await refresh();
    setBusy(null);
  }, [refresh]);

  const planDay = useCallback(async () => {
    setBusy('plan'); setError(null);
    const { data, error: err } = await plannerService.planDay(date);
    if (err) setError(err.message);
    if (data) setPlanPreview(data);
    setBusy(null);
  }, [date]);

  const applyPlan = useCallback(async () => {
    setBusy('plan'); setError(null);
    const { error: err } = await plannerService.planDay(date, true);
    if (err) setError(err.message);
    else setPlanPreview(null);
    await refresh();
    setBusy(null);
  }, [date, refresh]);

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

  const completeTask = useCallback(async (id: string) => { await plannerService.completeTask(id); await refresh(); }, [refresh]);
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
    inbox, tasks, blocks, insights, briefing, planPreview,
    loading, busy, error, date, setDate,
    refresh, classify, planDay, applyPlan, regenerateInsights, regenerateBriefing,
    completeTask, postponeTask, deleteTask, createBlock, dismissInsight,
  };
}
