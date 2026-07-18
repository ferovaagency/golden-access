// CEO Report generator — synthesizes a daily / weekly / monthly executive
// report from the BI context. Deterministic KPIs + AI narrative via Lovable AI.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { loadBIContext, toCop, daysBetween } from "../_shared/bi-context.ts";

type Period = "daily" | "weekly" | "monthly";

function periodWindow(period: Period, today: Date): { start: Date; end: Date; prevStart: Date; prevEnd: Date } {
  const end = new Date(today);
  const start = new Date(today);
  if (period === "daily") start.setDate(end.getDate());
  else if (period === "weekly") start.setDate(end.getDate() - 6);
  else start.setDate(end.getDate() - 29);
  const span = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
  const prevEnd = new Date(start); prevEnd.setDate(prevEnd.getDate() - 1);
  const prevStart = new Date(prevEnd); prevStart.setDate(prevStart.getDate() - span + 1);
  return { start, end, prevStart, prevEnd };
}

function inRange(dateStr: string, start: Date, end: Date): boolean {
  const d = new Date(dateStr);
  return d >= start && d <= new Date(end.getTime() + 86400000 - 1);
}

async function generateNarrative(payload: any, period: Period): Promise<{ headline: string; summary_md: string; wins: string[]; risks: string[]; priorities: string[] } | null> {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) return null;
  const label = period === "daily" ? "hoy" : period === "weekly" ? "esta semana" : "este mes";
  const prompt = `Eres el asesor ejecutivo del dueño de este negocio. Genera un reporte CEO de ${label} en JSON estricto con: headline (frase corta con la métrica más importante), summary_md (2-3 párrafos en markdown), wins (array de 3 logros), risks (array de 3 riesgos), priorities (array de 3 acciones concretas para mañana). Idioma español, tono directo y accionable.\n\nDATOS:\n${JSON.stringify(payload).slice(0, 8000)}`;
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) { console.error("[ceo-report AI]", res.status, await res.text()); return null; }
    const j = await res.json();
    const text = j?.choices?.[0]?.message?.content || "{}";
    const parsed = JSON.parse(text);
    return {
      headline: String(parsed.headline || "").slice(0, 200),
      summary_md: String(parsed.summary_md || ""),
      wins: Array.isArray(parsed.wins) ? parsed.wins.slice(0, 5).map(String) : [],
      risks: Array.isArray(parsed.risks) ? parsed.risks.slice(0, 5).map(String) : [],
      priorities: Array.isArray(parsed.priorities) ? parsed.priorities.slice(0, 5).map(String) : [],
    };
  } catch (err) { console.error("[ceo-report narrative]", err); return null; }
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
    const body = await req.json().catch(() => ({}));
    const period: Period = (body.period === "daily" || body.period === "weekly" || body.period === "monthly") ? body.period : "weekly";

    const ctx = await loadBIContext(admin, userId);
    const today = new Date(ctx.today);
    const { start, end, prevStart, prevEnd } = periodWindow(period, today);
    const trm = ctx.meta.trm;

    const salesNow = ctx.sales.filter((s) => inRange(s.fecha, start, end));
    const salesPrev = ctx.sales.filter((s) => inRange(s.fecha, prevStart, prevEnd));
    const expNow = ctx.expenses.filter((e) => inRange(e.fecha, start, end));
    const expPrev = ctx.expenses.filter((e) => inRange(e.fecha, prevStart, prevEnd));
    const hoursNow = ctx.hours.filter((h) => inRange(h.fecha, start, end));

    const revenue = salesNow.reduce((a, s) => a + toCop(s.precio_venta_unitario * s.cantidad, s.moneda, trm), 0);
    const revenuePrev = salesPrev.reduce((a, s) => a + toCop(s.precio_venta_unitario * s.cantidad, s.moneda, trm), 0);
    const directCosts = salesNow.reduce((a, s) => a + toCop(s.costo_unitario * s.cantidad, s.moneda, trm), 0);
    const directCostsPrev = salesPrev.reduce((a, s) => a + toCop(s.costo_unitario * s.cantidad, s.moneda, trm), 0);
    const paidExpenses = expNow.reduce((a, e) => a + toCop(e.monto, e.moneda, trm), 0);
    const paidExpensesPrev = expPrev.reduce((a, e) => a + toCop(e.monto, e.moneda, trm), 0);
    const inRangeAmount = (items: Array<{ fecha: string; monto: number; moneda: string }>, windowStart: Date, windowEnd: Date) =>
      items.filter((item) => inRange(item.fecha, windowStart, windowEnd)).reduce((total, item) => total + toCop(item.monto, item.moneda, trm), 0);
    const salesCollections = inRangeAmount(ctx.salesPayments.map((payment) => ({ ...payment, moneda: "COP" })), start, end);
    const salesCollectionsPrev = inRangeAmount(ctx.salesPayments.map((payment) => ({ ...payment, moneda: "COP" })), prevStart, prevEnd);
    const receivableCollections = inRangeAmount(ctx.receivablePayments, start, end);
    const receivableCollectionsPrev = inRangeAmount(ctx.receivablePayments, prevStart, prevEnd);
    const payablePayments = inRangeAmount(ctx.payablePayments, start, end);
    const payablePaymentsPrev = inRangeAmount(ctx.payablePayments, prevStart, prevEnd);
    const debtPayments = inRangeAmount(ctx.debtPayments, start, end);
    const debtPaymentsPrev = inRangeAmount(ctx.debtPayments, prevStart, prevEnd);
    const cashIn = salesCollections + receivableCollections;
    const cashInPrev = salesCollectionsPrev + receivableCollectionsPrev;
    const cashOut = paidExpenses + payablePayments + debtPayments;
    const cashOutPrev = paidExpensesPrev + payablePaymentsPrev + debtPaymentsPrev;
    const cash = cashIn - cashOut;
    const cashPrev = cashInPrev - cashOutPrev;
    const grossMargin = revenue - directCosts;
    const operatingResult = grossMargin - paidExpenses;
    const outstandingReceivables = ctx.receivables.filter((item) => !["pagada", "cancelada"].includes((item.estado || "").toLowerCase())).reduce((total, item) => total + toCop(item.valor, item.moneda, trm), 0);
    const outstandingPayables = ctx.payables.filter((item) => !["pagada", "cancelada"].includes((item.estado || "").toLowerCase())).reduce((total, item) => total + toCop(Math.max(0, item.valor - (item.monto_pagado || 0)), item.moneda, trm), 0);
    const growth = revenuePrev > 0 ? (revenue - revenuePrev) / revenuePrev : (revenue > 0 ? 1 : 0);
    const hoursTotal = hoursNow.reduce((a, h) => a + Number(h.horas || 0), 0);
    const newClients = new Set(salesNow.map((s) => s.cliente_id).filter(Boolean)).size;
    const activeOpps = ctx.opportunities.filter((o) => !["ganado","perdido","descartado","won","lost"].includes((o.estado || "").toLowerCase())).length;
    const wonOpps = ctx.opportunities.filter((o) => ["ganado","won"].includes((o.estado || "").toLowerCase())).length;

    const { data: healthRow } = await admin
      .from("business_health_snapshots")
      .select("score")
      .eq("user_id", userId)
      .lte("snapshot_date", ctx.today)
      .order("snapshot_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    const metrics = {
      revenue_cop: Math.round(revenue),
      revenue_prev_cop: Math.round(revenuePrev),
      revenue_growth: Number(growth.toFixed(3)),
      direct_costs_cop: Math.round(directCosts),
      direct_costs_prev_cop: Math.round(directCostsPrev),
      gross_margin_cop: Math.round(grossMargin),
      gross_margin_pct: revenue > 0 ? Number((grossMargin / revenue).toFixed(3)) : null,
      expenses_cop: Math.round(paidExpenses),
      expenses_prev_cop: Math.round(paidExpensesPrev),
      operating_result_cop: Math.round(operatingResult),
      cash_in_cop: Math.round(cashIn),
      cash_out_cop: Math.round(cashOut),
      cash_cop: Math.round(cash),
      cash_prev_cop: Math.round(cashPrev),
      outstanding_receivables_cop: Math.round(outstandingReceivables),
      outstanding_payables_cop: Math.round(outstandingPayables),
      hours_worked: Math.round(hoursTotal * 10) / 10,
      new_clients: newClients,
      active_opportunities: activeOpps,
      won_opportunities: wonOpps,
      sales_count: salesNow.length,
      period_start: start.toISOString().slice(0, 10),
      period_end: end.toISOString().slice(0, 10),
    };

    const aiPayload = {
      period,
      profile: ctx.profile,
      metrics,
      top_services: Object.values(salesNow.reduce((grouped: Record<string, any>, sale) => {
        const entry = grouped[sale.servicio_id] || { servicio: sale.servicio_nombre, ingresos_cop: 0, costo_directo_cop: 0, horas: 0 };
        entry.ingresos_cop += toCop(sale.precio_venta_unitario * sale.cantidad, sale.moneda, trm);
        entry.costo_directo_cop += toCop(sale.costo_unitario * sale.cantidad, sale.moneda, trm);
        grouped[sale.servicio_id] = entry;
        return grouped;
      }, {})).sort((a: any, b: any) => b.ingresos_cop - a.ingresos_cop).slice(0, 5),
      recent_opps: ctx.opportunities.slice(0, 10),
      recent_reviews: ctx.reviews.slice(0, 5),
      health_score: healthRow?.score ?? null,
    };
    const narrative = await generateNarrative(aiPayload, period);

    const record = {
      user_id: userId,
      period,
      period_start: metrics.period_start,
      period_end: metrics.period_end,
      headline: narrative?.headline || `Ingresos ${period}: $${Math.round(revenue).toLocaleString("es-CO")} COP`,
      summary_md: narrative?.summary_md || `Facturación ${Math.round(revenue).toLocaleString("es-CO")} COP vs ${Math.round(revenuePrev).toLocaleString("es-CO")} previo. Margen bruto ${Math.round(grossMargin).toLocaleString("es-CO")} COP. Flujo de caja neto ${Math.round(cash).toLocaleString("es-CO")} COP (cobrado menos pagos reales).`,
      wins: narrative?.wins || [],
      risks: narrative?.risks || [],
      priorities: narrative?.priorities || [],
      metrics,
      health_score: healthRow?.score ?? null,
    };

    const { data: saved, error: saveErr } = await admin
      .from("ceo_reports")
      .upsert(record, { onConflict: "user_id,period,period_start" })
      .select()
      .single();
    if (saveErr) throw saveErr;

    return new Response(JSON.stringify({ ok: true, report: saved }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("[ceo-report-generate]", err);
    return new Response(JSON.stringify({ ok: false, message: err instanceof Error ? err.message : String(err) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
