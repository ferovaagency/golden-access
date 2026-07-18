// Decision simulator — runs "what if" scenarios (hire, price change, invest,
// cut cost, promo) with deterministic math + AI recommendation. Persists each
// simulation for later reference.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { loadBIContext, toCop } from "../_shared/bi-context.ts";

type Scenario = "hire" | "price_change" | "invest" | "cut_cost" | "promo" | "custom";

interface Inputs {
  // hire: monthly_cost, expected_extra_hours_month, avg_hourly_rate
  monthly_cost?: number;
  expected_extra_hours_month?: number;
  avg_hourly_rate?: number;
  // price_change: pct (0.1 = +10%), demand_elasticity (default -1)
  pct?: number;
  demand_elasticity?: number;
  // invest: upfront_cost, expected_monthly_return, months
  upfront_cost?: number;
  expected_monthly_return?: number;
  months?: number;
  // cut_cost: monthly_saving, risk_note
  monthly_saving?: number;
  risk_note?: string;
  // promo: discount_pct, expected_volume_multiplier
  discount_pct?: number;
  expected_volume_multiplier?: number;
}

function simulate(scenario: Scenario, inputs: Inputs, baseline: { avgMonthlyRevenue: number; avgMonthlyExpense: number; avgHourlyRate: number }) {
  const m = baseline.avgMonthlyRevenue;
  const c = baseline.avgMonthlyExpense;
  const netNow = m - c;

  switch (scenario) {
    case "hire": {
      const cost = Number(inputs.monthly_cost || 0);
      const extraHours = Number(inputs.expected_extra_hours_month || 0);
      const rate = Number(inputs.avg_hourly_rate || baseline.avgHourlyRate || 0);
      const extraRev = extraHours * rate;
      const netAfter = netNow + extraRev - cost;
      const payback = cost > 0 && extraRev - cost > 0 ? cost / (extraRev - cost) : null;
      return { extra_revenue_month: Math.round(extraRev), extra_cost_month: Math.round(cost), net_before: Math.round(netNow), net_after: Math.round(netAfter), delta: Math.round(netAfter - netNow), payback_months: payback ? Number(payback.toFixed(1)) : null };
    }
    case "price_change": {
      const pct = Number(inputs.pct || 0);
      const elasticity = Number(inputs.demand_elasticity ?? -1);
      const demandChange = 1 + elasticity * pct;
      const revAfter = m * (1 + pct) * demandChange;
      const netAfter = revAfter - c;
      return { revenue_before: Math.round(m), revenue_after: Math.round(revAfter), net_before: Math.round(netNow), net_after: Math.round(netAfter), delta: Math.round(netAfter - netNow), assumed_demand_change_pct: Number((demandChange - 1).toFixed(3)) };
    }
    case "invest": {
      const upfront = Number(inputs.upfront_cost || 0);
      const monthly = Number(inputs.expected_monthly_return || 0);
      const months = Number(inputs.months || 12);
      const total = monthly * months;
      const roi = upfront > 0 ? (total - upfront) / upfront : null;
      const payback = monthly > 0 ? upfront / monthly : null;
      return { upfront_cost: Math.round(upfront), total_return: Math.round(total), roi_pct: roi !== null ? Number((roi * 100).toFixed(1)) : null, payback_months: payback ? Number(payback.toFixed(1)) : null, months };
    }
    case "cut_cost": {
      const saving = Number(inputs.monthly_saving || 0);
      const netAfter = netNow + saving;
      return { monthly_saving: Math.round(saving), net_before: Math.round(netNow), net_after: Math.round(netAfter), delta: Math.round(saving), risk_note: inputs.risk_note || "" };
    }
    case "promo": {
      const disc = Number(inputs.discount_pct || 0);
      const volMult = Number(inputs.expected_volume_multiplier || 1);
      const revAfter = m * (1 - disc) * volMult;
      const netAfter = revAfter - c;
      return { revenue_before: Math.round(m), revenue_after: Math.round(revAfter), net_before: Math.round(netNow), net_after: Math.round(netAfter), delta: Math.round(netAfter - netNow), volume_multiplier: volMult };
    }
    default:
      return { note: "Escenario custom — usa la recomendación IA con la pregunta libre." };
  }
}

async function aiRecommendation(question: string, scenario: Scenario, inputs: Inputs, result: any, ctxSummary: any): Promise<string | null> {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) return null;
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Eres el asesor financiero del dueño. Responde en español, directo, con recomendación final clara (proceder/no proceder/con condiciones) y 3 bullets de por qué." },
          { role: "user", content: `PREGUNTA: ${question}\nESCENARIO: ${scenario}\nINPUTS: ${JSON.stringify(inputs)}\nRESULTADO: ${JSON.stringify(result)}\nCONTEXTO: ${JSON.stringify(ctxSummary)}` },
        ],
      }),
    });
    if (!res.ok) { console.error("[decision-simulate AI]", res.status, await res.text()); return null; }
    const j = await res.json();
    return j?.choices?.[0]?.message?.content || null;
  } catch (err) { console.error("[decision-simulate AI]", err); return null; }
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
    const scenario: Scenario = body.scenario_type || "custom";
    const question: string = String(body.question || "").slice(0, 500);
    const inputs: Inputs = body.inputs || {};

    const ctx = await loadBIContext(admin, userId);
    const trm = ctx.meta.trm;
    const days = 30;
    const now = new Date(ctx.today);
    const recentSales = ctx.sales.filter((s) => (now.getTime() - new Date(s.fecha).getTime()) / 86400000 <= days);
    const recentExp = ctx.expenses.filter((e) => (now.getTime() - new Date(e.fecha).getTime()) / 86400000 <= days);
    const recentHours = ctx.hours.filter((h) => (now.getTime() - new Date(h.fecha).getTime()) / 86400000 <= days);
    const revenue = recentSales.reduce((a, s) => a + toCop(s.precio_venta_unitario * s.cantidad, s.moneda, trm), 0);
    const expenses = recentExp.reduce((a, e) => a + toCop(e.monto, e.moneda, trm), 0);
    const hoursTotal = recentHours.reduce((a, h) => a + Number(h.horas || 0), 0);
    const baseline = { avgMonthlyRevenue: revenue, avgMonthlyExpense: expenses, avgHourlyRate: hoursTotal > 0 ? revenue / hoursTotal : 0 };

    const result = simulate(scenario, inputs, baseline);
    const recommendation = await aiRecommendation(question, scenario, inputs, result, { baseline, health_hint: ctx.overview });

    const { data: saved, error: saveErr } = await admin
      .from("decision_simulations")
      .insert({ user_id: userId, question: question || `Simulación ${scenario}`, scenario_type: scenario, inputs, result, recommendation })
      .select()
      .single();
    if (saveErr) throw saveErr;

    return new Response(JSON.stringify({ ok: true, simulation: saved, baseline }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("[decision-simulate]", err);
    return new Response(JSON.stringify({ ok: false, message: err instanceof Error ? err.message : String(err) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
