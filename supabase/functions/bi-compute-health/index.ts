// Business Health Score — 100% deterministic scoring across 10 dimensions.
// Uses the shared BI context. No AI required (fast, cheap, reliable).
// Writes a snapshot per user per day (upsert on user_id + snapshot_date).

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { loadBIContext, toCop, daysBetween, type BIContext } from "../_shared/bi-context.ts";

type SubScore = { label: string; score: number; weight: number; note: string };

function clamp(v: number, lo = 0, hi = 100): number { return Math.max(lo, Math.min(hi, v)); }

function computeSubScores(ctx: BIContext): SubScore[] {
  const trm = ctx.meta.trm;
  const now = new Date(ctx.today);
  const in30 = ctx.sales.filter((s) => daysBetween(s.fecha, now) <= 30);
  const in30prev = ctx.sales.filter((s) => { const d = daysBetween(s.fecha, now); return d > 30 && d <= 60; });
  const in90 = ctx.sales.filter((s) => daysBetween(s.fecha, now) <= 90);

  const revenueCop = (arr: typeof ctx.sales) => arr.reduce((a, s) => a + toCop(s.precio_venta_unitario * s.cantidad, s.moneda, trm), 0);
  const rev30 = revenueCop(in30);
  const revPrev = revenueCop(in30prev);
  const expenses30 = ctx.expenses.filter((e) => daysBetween(e.fecha, now) <= 30).reduce((a, e) => a + toCop(e.monto, e.moneda, trm), 0);

  // 1. Cash flow — ingresos30 vs. gastos30
  const cashRatio = expenses30 > 0 ? rev30 / expenses30 : rev30 > 0 ? 3 : 1;
  const cashFlow = clamp(cashRatio >= 2 ? 100 : cashRatio >= 1.3 ? 80 : cashRatio >= 1 ? 60 : cashRatio >= 0.7 ? 35 : 15);

  // 2. Profitability — margen bruto agregado
  const totalIng = ctx.services.reduce((a, s) => a + Number(s.ingresos_brutos || 0), 0);
  const totalCosto = ctx.services.reduce((a, s) => a + Number(s.costos_directos || 0), 0);
  const margen = totalIng > 0 ? (totalIng - totalCosto) / totalIng : 0;
  const profitability = clamp(margen >= 0.5 ? 100 : margen >= 0.35 ? 85 : margen >= 0.2 ? 65 : margen >= 0.05 ? 40 : 15);

  // 3. Revenue growth — 30d vs prev 30d
  const growth = revPrev > 0 ? (rev30 - revPrev) / revPrev : rev30 > 0 ? 0.2 : 0;
  const revenueGrowth = clamp(growth >= 0.3 ? 100 : growth >= 0.1 ? 80 : growth >= 0 ? 60 : growth >= -0.15 ? 35 : 15);

  // 4. Client retention — clientes activos con ventas recientes
  const activeIds = new Set(in90.map((s) => s.cliente_id).filter(Boolean));
  const totalClients = ctx.clients.length || 1;
  const retention = clamp(activeIds.size / totalClients >= 0.7 ? 100 : activeIds.size / totalClients >= 0.5 ? 75 : activeIds.size / totalClients >= 0.3 ? 55 : 30);

  // 5. Project performance — progreso promedio
  const activeClients = ctx.clients.filter((c) => c.activo);
  const avgProgress = activeClients.length ? activeClients.reduce((a, c) => a + Number(c.progreso || 0), 0) / activeClients.length : 60;
  const projectPerf = clamp(avgProgress);

  // 6. Outstanding invoices — % de ventas Pendiente/Adelanto
  const outstanding = ctx.sales.filter((s) => s.estado_pago !== "Pagado");
  const outstandingRatio = ctx.sales.length ? outstanding.length / ctx.sales.length : 0;
  const invoices = clamp(100 - outstandingRatio * 80);

  // 7. Time management — horas vs. objetivo
  const horas30 = ctx.hours.filter((h) => daysBetween(h.fecha, now) <= 30).reduce((a, h) => a + Number(h.horas || 0), 0);
  const goal = ctx.meta.horas_objetivo_mes || 160;
  const timeRatio = goal > 0 ? horas30 / goal : 0;
  const timeMgmt = clamp(timeRatio >= 0.85 && timeRatio <= 1.15 ? 100 : timeRatio >= 0.6 && timeRatio <= 1.3 ? 70 : timeRatio > 0 ? 45 : 30);

  // 8. Task completion — tasks done / total (últimos 30d)
  const recentTasks = ctx.tasks.filter((t) => daysBetween(t.created_at, now) <= 30);
  const doneTasks = recentTasks.filter((t) => t.status === "done").length;
  const completion = recentTasks.length ? doneTasks / recentTasks.length : 0.6;
  const taskCompletion = clamp(completion >= 0.75 ? 100 : completion >= 0.5 ? 75 : completion >= 0.3 ? 50 : 25);

  // 9. Pipeline health — oportunidades activas y con siguiente acción
  const activeOpps = ctx.opportunities.filter((o) => !["ganado", "perdido", "descartado", "won", "lost"].includes((o.estado || "").toLowerCase()));
  const withNext = activeOpps.filter((o) => !!o.siguiente_accion).length;
  const pipelineScore = activeOpps.length === 0 ? 30 : clamp((withNext / activeOpps.length) * 60 + Math.min(activeOpps.length / 10, 1) * 40);

  // 10. Workload balance — postpones + tasks urgentes sin agendar
  const postponed = recentTasks.filter((t) => (t.postponed_count || 0) >= 2).length;
  const urgentUnscheduled = recentTasks.filter((t) => t.priority === "urgent" && !t.scheduled_for && t.status !== "done").length;
  const overloadPenalty = Math.min(50, postponed * 5 + urgentUnscheduled * 8);
  const workload = clamp(100 - overloadPenalty);

  return [
    { label: "Flujo de caja", score: cashFlow, weight: 15, note: `Ingresos 30d ${Math.round(cashRatio * 10) / 10}x gastos` },
    { label: "Rentabilidad", score: profitability, weight: 15, note: `Margen bruto ${Math.round(margen * 100)}%` },
    { label: "Crecimiento", score: revenueGrowth, weight: 10, note: `${growth >= 0 ? "+" : ""}${Math.round(growth * 100)}% vs 30d previos` },
    { label: "Retención de clientes", score: retention, weight: 10, note: `${activeIds.size}/${totalClients} clientes activos` },
    { label: "Proyectos", score: projectPerf, weight: 10, note: `Progreso promedio ${Math.round(avgProgress)}%` },
    { label: "Cobros", score: invoices, weight: 10, note: `${outstanding.length} ventas sin pagar` },
    { label: "Tiempo", score: timeMgmt, weight: 8, note: `${Math.round(horas30)}h vs objetivo ${goal}h` },
    { label: "Ejecución de tareas", score: taskCompletion, weight: 8, note: `${Math.round(completion * 100)}% completadas` },
    { label: "Pipeline", score: pipelineScore, weight: 8, note: `${activeOpps.length} activas, ${withNext} con próximo paso` },
    { label: "Carga de trabajo", score: workload, weight: 6, note: postponed || urgentUnscheduled ? `${postponed} postergadas, ${urgentUnscheduled} urgentes sin agendar` : "Balanceada" },
  ];
}

function weightedScore(subs: SubScore[]): number {
  const total = subs.reduce((a, s) => a + s.weight, 0);
  const sum = subs.reduce((a, s) => a + s.score * s.weight, 0);
  return Math.round(sum / total);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) return new Response(JSON.stringify({ ok: false, message: "No autenticado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userError } = await userClient.auth.getUser(token);
    if (userError || !userData.user) return new Response(JSON.stringify({ ok: false, message: "Sesión inválida" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const userId = userData.user.id;

    const ctx = await loadBIContext(admin, userId);
    const subs = computeSubScores(ctx);
    const score = weightedScore(subs);

    const { data: prev } = await admin
      .from("business_health_snapshots")
      .select("score, snapshot_date")
      .eq("user_id", userId)
      .lt("snapshot_date", ctx.today)
      .order("snapshot_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    const previous_score = prev?.score ?? null;
    const delta = previous_score !== null ? score - previous_score : 0;

    const sorted = [...subs].sort((a, b) => a.score - b.score);
    const top_reasons = [
      ...sorted.slice(0, 3).map((s) => ({ kind: "weak", label: s.label, score: s.score, note: s.note })),
      ...sorted.slice(-2).reverse().map((s) => ({ kind: "strong", label: s.label, score: s.score, note: s.note })),
    ];

    const narrative = buildNarrative(score, delta, sorted);

    const { data: saved, error: saveErr } = await admin
      .from("business_health_snapshots")
      .upsert({
        user_id: userId,
        snapshot_date: ctx.today,
        score,
        previous_score,
        delta,
        sub_scores: subs,
        top_reasons,
        narrative,
        computed_at: new Date().toISOString(),
      }, { onConflict: "user_id,snapshot_date" })
      .select()
      .single();

    if (saveErr) throw saveErr;

    return new Response(JSON.stringify({ ok: true, snapshot: saved }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("[bi-compute-health]", err);
    return new Response(JSON.stringify({ ok: false, message: err instanceof Error ? err.message : String(err) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

function buildNarrative(score: number, delta: number, sorted: SubScore[]): string {
  const level = score >= 80 ? "sólida" : score >= 65 ? "estable" : score >= 45 ? "frágil" : "en riesgo";
  const trend = delta > 3 ? "subió" : delta < -3 ? "bajó" : "se mantiene";
  const weakest = sorted[0];
  const strongest = sorted[sorted.length - 1];
  return `Tu salud del negocio está ${level} (${score}/100) y ${trend} ${Math.abs(delta)} pts vs. la última medición. Lo más débil: ${weakest.label} (${weakest.score}/100 — ${weakest.note}). Lo más fuerte: ${strongest.label} (${strongest.score}/100).`;
}
