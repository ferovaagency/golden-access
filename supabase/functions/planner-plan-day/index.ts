// Creates a deterministic, reviewable day plan. AI classifies/explains tasks
// elsewhere; scheduling itself remains explainable and never overwrites a plan
// until the user explicitly confirms it with { apply: true }.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

type Category = "deep_work" | "meetings" | "admin" | "creative" | "calls" | "learning" | "personal" | "breaks";
type Task = { id: string; title: string; category: Category; priority: "low" | "medium" | "high" | "urgent"; energy_required: string; estimated_minutes: number; deadline: string | null; postponed_count: number | null };
type Block = { title: string; category: Category; starts_at: string; ends_at: string; task_ids: string[]; source: string; notes: string };

const PRIORITY_WEIGHT = { urgent: 0, high: 1, medium: 2, low: 3 } as const;
const SLOT_MINUTES = 15;
const MAX_DAILY_MINUTES = 480;

function overlaps(start: number, end: number, busy: Array<[number, number]>) {
  return busy.some(([busyStart, busyEnd]) => start < busyEnd && end > busyStart);
}

function isoAt(date: string, minute: number) {
  const hour = Math.floor(minute / 60);
  const min = minute % 60;
  return new Date(`${date}T${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")}:00`).toISOString();
}

function deadlineWeight(deadline: string | null, date: string) {
  if (!deadline) return Number.MAX_SAFE_INTEGER;
  const diff = new Date(deadline).getTime() - new Date(`${date}T23:59:59`).getTime();
  return Math.max(0, Math.ceil(diff / 86_400_000));
}

function parseHorario(value: string | null | undefined, fallbackMinutes: number): number {
  const match = typeof value === "string" ? value.match(/^(\d{1,2}):(\d{2})$/) : null;
  if (!match) return fallbackMinutes;
  const hours = Math.min(23, Math.max(0, Number(match[1])));
  const minutes = Math.min(59, Math.max(0, Number(match[2])));
  return hours * 60 + minutes;
}

function buildPlan(date: string, tasks: Task[], lockedBlocks: Array<{ starts_at: string; ends_at: string }>, workStart: number, workEnd: number): Block[] {
  const busy = lockedBlocks.map((block) => {
    const start = new Date(block.starts_at);
    const end = new Date(block.ends_at);
    return [start.getHours() * 60 + start.getMinutes(), end.getHours() * 60 + end.getMinutes()] as [number, number];
  });
  const ordered = [...tasks].sort((a, b) => {
    const priority = PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority];
    if (priority) return priority;
    const due = deadlineWeight(a.deadline, date) - deadlineWeight(b.deadline, date);
    if (due) return due;
    return Number(b.postponed_count || 0) - Number(a.postponed_count || 0);
  });
  const blocks: Block[] = [];
  let plannedMinutes = 0;
  // "Tarde" (para admin/calls) es el tercio final de la jornada laboral, no
  // siempre las 2pm -- con un horario 08:00-14:00 eso caería fuera de rango.
  const afternoonStart = workStart + Math.round(((workEnd - workStart) * 2) / 3);
  const midMorningStart = workStart + Math.round((workEnd - workStart) / 6);

  for (const task of ordered) {
    if (plannedMinutes >= MAX_DAILY_MINUTES) break;
    const maxBlock = Math.max(SLOT_MINUTES, workEnd - workStart);
    const duration = Math.max(SLOT_MINUTES, Math.min(120, maxBlock, Math.ceil(Number(task.estimated_minutes || 30) / SLOT_MINUTES) * SLOT_MINUTES));
    const preferredStart = task.category === "deep_work" || task.energy_required === "high" ? workStart : task.category === "admin" || task.category === "calls" ? afternoonStart : midMorningStart;
    let start = preferredStart;
    while (start + duration <= workEnd && overlaps(start, start + duration, busy)) start += SLOT_MINUTES;
    if (start + duration > workEnd) {
      start = workStart;
      while (start + duration <= workEnd && overlaps(start, start + duration, busy)) start += SLOT_MINUTES;
    }
    if (start + duration > workEnd) continue;

    const suffix = Number(task.estimated_minutes) > 120 ? " (primer bloque)" : "";
    blocks.push({
      title: `${task.title}${suffix}`,
      category: task.category,
      starts_at: isoAt(date, start),
      ends_at: isoAt(date, start + duration),
      task_ids: [task.id],
      source: "planner-rules",
      notes: `Programado por prioridad ${task.priority}, fecha limite y espacios libres; respeta bloques protegidos.`,
    });
    busy.push([start, start + duration]);
    plannedMinutes += duration;
  }
  return blocks.sort((a, b) => a.starts_at.localeCompare(b.starts_at));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization") || "";
    const token = auth.replace("Bearer ", "");
    if (!token) return json({ ok: false, message: "No autenticado" }, 401);
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: userData, error: userError } = await userClient.auth.getUser(token);
    if (userError || !userData.user) return json({ ok: false, message: "Sesion invalida" }, 401);

    const body = await req.json().catch(() => ({}));
    const date = typeof body?.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? body.date : new Date().toISOString().slice(0, 10);
    const apply = body?.apply === true;
    const dayStart = new Date(`${date}T00:00:00`).toISOString();
    const dayEnd = new Date(`${date}T23:59:59`).toISOString();
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const [{ data: tasks }, { data: existingBlocks }, { data: profile }] = await Promise.all([
      admin.from("planner_tasks").select("id,title,category,priority,energy_required,estimated_minutes,deadline,postponed_count").eq("user_id", userData.user.id).in("status", ["backlog", "scheduled", "postponed"]).limit(40),
      admin.from("planner_blocks").select("starts_at,ends_at,protected,source").eq("user_id", userData.user.id).gte("starts_at", dayStart).lte("starts_at", dayEnd),
      admin.from("business_profile").select("dias_laborales,horario_inicio,horario_fin").eq("user_id", userData.user.id).maybeSingle(),
    ]);

    const diasLaborales: number[] = Array.isArray(profile?.dias_laborales) && profile.dias_laborales.length ? profile.dias_laborales : [1, 2, 3, 4, 5];
    const dayOfWeek = new Date(`${date}T12:00:00`).getDay();
    if (!diasLaborales.includes(dayOfWeek)) {
      return json({ ok: true, preview: !apply, summary: "Hoy no es un día laboral según tu configuración (Ajustes → días de trabajo) -- no se programaron bloques.", blocks: [] });
    }

    const workStart = parseHorario(profile?.horario_inicio, 8 * 60);
    let workEnd = parseHorario(profile?.horario_fin, 18 * 60);
    if (workEnd <= workStart) workEnd = workStart + 8 * 60; // config inconsistente -- no dejar una jornada de 0 minutos

    const locked = (existingBlocks || []).filter((block: any) => block.protected || block.source === "google" || block.source === "external");
    const blocks = buildPlan(date, (tasks || []) as Task[], locked, workStart, workEnd);
    const summary = blocks.length
      ? `${blocks.length} bloques propuestos dentro de tu horario laboral (${profile?.horario_inicio || "08:00"}-${profile?.horario_fin || "18:00"}); los eventos protegidos se conservaran.`
      : "No hay espacio suficiente en tu horario laboral o no hay tareas pendientes para programar.";

    if (!apply) return json({ ok: true, preview: true, summary, blocks });

    await admin.from("planner_blocks").delete().eq("user_id", userData.user.id).in("source", ["ai", "planner-rules"]).gte("starts_at", dayStart).lte("starts_at", dayEnd);
    if (blocks.length) {
      const { error: insertError } = await admin.from("planner_blocks").insert(blocks.map((block) => ({ ...block, user_id: userData.user.id })));
      if (insertError) throw insertError;
      const taskIds = blocks.flatMap((block) => block.task_ids);
      await admin.from("planner_tasks").update({ status: "scheduled", scheduled_for: dayStart }).in("id", taskIds).eq("user_id", userData.user.id);
    }
    return json({ ok: true, preview: false, summary, blocks });
  } catch (error) {
    console.error("[planner-plan-day] error", error);
    return json({ ok: false, message: error instanceof Error ? error.message : String(error) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
