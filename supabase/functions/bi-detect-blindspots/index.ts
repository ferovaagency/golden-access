// Business Blind Spots — deterministic detector across 14 categories.
// Upserts findings by fingerprint so the same recurring risk doesn't duplicate.
// Auto-resolves previously detected items that no longer match.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { loadBIContext, toCop, daysBetween, type BIContext } from "../_shared/bi-context.ts";

type Urgency = "critical" | "high" | "medium" | "low";
type Category =
  | "client_at_risk" | "revenue_concentration" | "cash_risk" | "late_invoice"
  | "project_hours_overrun" | "low_margin_project" | "employee_overload"
  | "unused_capacity" | "no_followup" | "postponed_task" | "marketing_inactive"
  | "low_sales_activity" | "bottleneck" | "opportunity";

interface Finding {
  fingerprint: string;
  category: Category;
  urgency: Urgency;
  title: string;
  why: string;
  impact: string;
  action: string;
  entity_type?: string;
  entity_id?: string;
  action_route?: string;
  metric_value?: number;
  metric_label?: string;
}

const fmt = (n: number) => new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(Math.round(n));

function detect(ctx: BIContext): Finding[] {
  const out: Finding[] = [];
  const trm = ctx.meta.trm;
  const now = new Date(ctx.today);

  // 1. Cliente en riesgo — activo pero sin venta hace 60+ días
  for (const c of ctx.clients.filter((c) => c.activo)) {
    const lastSale = ctx.sales.filter((s) => s.cliente_id === c.id).sort((a, b) => b.fecha.localeCompare(a.fecha))[0];
    const daysIdle = lastSale ? daysBetween(lastSale.fecha, now) : 999;
    if (daysIdle >= 60) {
      out.push({
        fingerprint: `client_risk:${c.id}`,
        category: "client_at_risk",
        urgency: daysIdle >= 120 ? "critical" : "high",
        title: `${c.nombre} lleva ${daysIdle} días sin actividad`,
        why: `Es un cliente activo pero no registra ventas ni interacciones recientes.`,
        impact: `Riesgo de perder la cuenta. Cada cliente perdido cuesta ~5x lo que cuesta reactivarlo.`,
        action: `Enviá un check-in hoy: pregunta cómo va lo último que hicieron y si hay algo nuevo en su radar.`,
        entity_type: "cliente", entity_id: c.id, action_route: "clientes",
        metric_value: daysIdle, metric_label: "días inactivo",
      });
    }
  }

  // 2. Concentración de ingresos — un cliente representa >40% del ingreso
  const in90 = ctx.sales.filter((s) => daysBetween(s.fecha, now) <= 90);
  const byClient = new Map<string, { name: string; total: number }>();
  let totalRev = 0;
  for (const s of in90) {
    const cop = toCop(s.precio_venta_unitario * s.cantidad, s.moneda, trm);
    totalRev += cop;
    const key = s.cliente_id || s.cliente_nombre;
    const cur = byClient.get(key) || { name: s.cliente_nombre, total: 0 };
    cur.total += cop;
    byClient.set(key, cur);
  }
  if (totalRev > 0) {
    for (const [id, v] of byClient) {
      const share = v.total / totalRev;
      if (share >= 0.4) {
        out.push({
          fingerprint: `revenue_conc:${id}`,
          category: "revenue_concentration",
          urgency: share >= 0.6 ? "critical" : "high",
          title: `${v.name} = ${Math.round(share * 100)}% de tu ingreso`,
          why: `Un solo cliente concentra la mayoría del ingreso de los últimos 90 días ($${fmt(v.total)}).`,
          impact: `Si se va o baja el ritmo, tu flujo cae de un mes al otro.`,
          action: `Priorizá cerrar 2-3 clientes nuevos este trimestre y diversificá.`,
          entity_type: "cliente", entity_id: id, action_route: "clientes",
          metric_value: Math.round(share * 100), metric_label: "% del ingreso",
        });
      }
    }
  }

  // 3. Cash risk — gastos 30d > ingresos 30d
  const in30 = ctx.sales.filter((s) => daysBetween(s.fecha, now) <= 30);
  const rev30 = in30.reduce((a, s) => a + toCop(s.precio_venta_unitario * s.cantidad, s.moneda, trm), 0);
  const exp30 = ctx.expenses.filter((e) => daysBetween(e.fecha, now) <= 30).reduce((a, e) => a + toCop(e.monto, e.moneda, trm), 0);
  if (exp30 > rev30 && exp30 > 0) {
    const gap = exp30 - rev30;
    out.push({
      fingerprint: `cash_risk:month`,
      category: "cash_risk",
      urgency: gap > rev30 * 0.3 ? "critical" : "high",
      title: `Gastás $${fmt(gap)} más de lo que ingresa este mes`,
      why: `Ingresos 30d: $${fmt(rev30)} · Gastos 30d: $${fmt(exp30)}.`,
      impact: `Estás quemando caja. Sin cambio, se agota el colchón.`,
      action: `Revisá gastos recortables y acelerá cobros pendientes esta semana.`,
      action_route: "gastos",
      metric_value: gap, metric_label: "déficit COP",
    });
  }

  // 4. Facturas vencidas — venta con estado Pendiente/Adelanto y fecha > 30 días
  const late = ctx.sales.filter((s) => s.estado_pago !== "Pagado" && daysBetween(s.fecha, now) > 30);
  if (late.length > 0) {
    const totalLate = late.reduce((a, s) => a + toCop((s.precio_venta_unitario * s.cantidad) - (s.adelanto || 0), s.moneda, trm), 0);
    out.push({
      fingerprint: `late_invoices:agg`,
      category: "late_invoice",
      urgency: totalLate > exp30 * 0.5 ? "critical" : "high",
      title: `${late.length} cobros vencidos por $${fmt(totalLate)}`,
      why: `Ventas con más de 30 días sin cierre de pago completo.`,
      impact: `Ese dinero está trabado. Cobrar hoy = oxígeno inmediato.`,
      action: `Enviá recordatorios de pago hoy. Priorizá el más grande primero.`,
      action_route: "ventas",
      metric_value: totalLate, metric_label: "COP pendientes",
    });
  }

  // 5. Proyectos consumiendo demasiadas horas / bajo margen
  for (const svc of ctx.services) {
    if (svc.margen_bruto < 0.15 && svc.ingresos_brutos > 0) {
      out.push({
        fingerprint: `low_margin:${svc.servicio_nombre}`,
        category: "low_margin_project",
        urgency: svc.margen_bruto < 0 ? "critical" : "medium",
        title: `${svc.servicio_nombre}: margen ${Math.round(svc.margen_bruto * 100)}%`,
        why: `Ingresos $${fmt(svc.ingresos_brutos)} vs. costos $${fmt(svc.costos_directos)}.`,
        impact: `Estás trabajando barato o gastando de más en este servicio.`,
        action: `Subí el precio, bajá el costo, o considera dejar de ofrecerlo.`,
        entity_type: "servicio", action_route: "servicios",
        metric_value: Math.round(svc.margen_bruto * 100), metric_label: "% margen",
      });
    }
    if (svc.horas_registradas > 0 && svc.ventas_count > 0) {
      const horasPorVenta = svc.horas_registradas / svc.ventas_count;
      const ingresoPorHora = svc.ingresos_brutos / svc.horas_registradas;
      if (ingresoPorHora < 30_000 && svc.horas_registradas > 20) {
        out.push({
          fingerprint: `hours_overrun:${svc.servicio_nombre}`,
          category: "project_hours_overrun",
          urgency: "medium",
          title: `${svc.servicio_nombre} rinde $${fmt(ingresoPorHora)}/hora`,
          why: `Estás dedicando ${Math.round(horasPorVenta)}h por venta y el ingreso/hora es bajo.`,
          impact: `Cada hora en este servicio compite con cosas más rentables.`,
          action: `Automatizá pasos, subí el precio, o descartá el servicio.`,
          action_route: "horas",
          metric_value: Math.round(ingresoPorHora), metric_label: "COP/hora",
        });
      }
    }
  }

  // 6. Overload / capacidad inactiva
  const horas30 = ctx.hours.filter((h) => daysBetween(h.fecha, now) <= 30).reduce((a, h) => a + Number(h.horas || 0), 0);
  const goal = ctx.meta.horas_objetivo_mes || 160;
  if (horas30 > goal * 1.2) {
    out.push({
      fingerprint: `overload:month`, category: "employee_overload", urgency: "high",
      title: `Estás ${Math.round(((horas30 / goal) - 1) * 100)}% sobre tu objetivo de horas`,
      why: `${Math.round(horas30)}h registradas vs. objetivo ${goal}h.`,
      impact: `Trabajás de más → menos calidad, más burnout, menos capacidad para vender.`,
      action: `Delegá o rechazá el próximo trabajo que no sea prioridad clara.`,
      action_route: "horas", metric_value: Math.round(horas30), metric_label: "horas mes",
    });
  } else if (horas30 < goal * 0.5 && horas30 > 0) {
    out.push({
      fingerprint: `unused_capacity:month`, category: "unused_capacity", urgency: "medium",
      title: `Solo llevás ${Math.round(horas30)}h de tu objetivo (${goal}h)`,
      why: `Tenés capacidad libre este mes.`,
      impact: `Espacio para tomar más trabajo o invertir tiempo en crecer el negocio.`,
      action: `Retomá un lead frío o dedicá tiempo a marketing/producto.`,
      action_route: "horas", metric_value: Math.round(horas30), metric_label: "horas mes",
    });
  }

  // 7. Oportunidades sin siguiente acción
  const noFollow = ctx.opportunities.filter((o) => !["ganado", "perdido", "descartado"].includes((o.estado || "").toLowerCase()) && !o.siguiente_accion);
  if (noFollow.length >= 3) {
    out.push({
      fingerprint: `no_followup:pipeline`, category: "no_followup", urgency: "high",
      title: `${noFollow.length} oportunidades sin próximo paso`,
      why: `Están en el pipeline pero nadie definió qué hacer después.`,
      impact: `Pipeline sin acción = pipeline muerto en 2 semanas.`,
      action: `Abrí el pipeline y asigná una acción concreta a cada una.`,
      action_route: "crm", metric_value: noFollow.length, metric_label: "oportunidades",
    });
  }

  // 8. Postponed tasks
  const postponed = ctx.tasks.filter((t) => (t.postponed_count || 0) >= 3 && t.status !== "done");
  if (postponed.length >= 2) {
    out.push({
      fingerprint: `postponed:agg`, category: "postponed_task", urgency: "medium",
      title: `${postponed.length} tareas postergadas 3+ veces`,
      why: `Aparecen día tras día sin completarse.`,
      impact: `O no son importantes (eliminarlas) o son bloqueos (desbloquearlas ya).`,
      action: `Revisá cada una: hacela hoy, delegala o descartala.`,
      action_route: "planner", metric_value: postponed.length, metric_label: "tareas",
    });
  }

  // 9. Marketing inactivity — sin reseñas nuevas ni oportunidades entrantes en 30d
  const oppRecent = ctx.opportunities.filter((o) => daysBetween(o.updated_at, now) <= 30).length;
  const reviewsRecent = ctx.reviews.filter((r) => daysBetween(r.detectada_en, now) <= 30).length;
  if (oppRecent === 0 && reviewsRecent === 0) {
    out.push({
      fingerprint: `marketing_inactive:month`, category: "marketing_inactive", urgency: "high",
      title: `Cero prospectos y cero reseñas nuevas este mes`,
      why: `No entra pipeline nuevo ni feedback público.`,
      impact: `Sin generación de demanda, el ingreso futuro se cae.`,
      action: `Definí una acción de marketing esta semana: contenido, outbound o pedido de reseña.`,
      action_route: "crm",
    });
  }

  // 10. Low sales activity — 0 ventas en 14 días
  const in14 = ctx.sales.filter((s) => daysBetween(s.fecha, now) <= 14).length;
  if (in14 === 0 && ctx.sales.length > 0) {
    out.push({
      fingerprint: `low_sales:14d`, category: "low_sales_activity", urgency: "high",
      title: `Sin ventas registradas en 14 días`,
      why: `El motor comercial está apagado.`,
      impact: `Sin ingresos nuevos, el mes se te va encima.`,
      action: `Cerrá o factura una venta esta semana; llamá a los últimos 5 prospectos.`,
      action_route: "ventas",
    });
  }

  // 11. Reseñas sin responder
  const noReply = ctx.reviews.filter((r) => !r.respondida).length;
  if (noReply >= 3) {
    out.push({
      fingerprint: `reviews_unreplied:agg`, category: "bottleneck", urgency: "medium",
      title: `${noReply} reseñas sin responder`,
      why: `Reseñas públicas esperando tu respuesta.`,
      impact: `Responder mejora tu reputación pública y el SEO local.`,
      action: `Respondé todas hoy — cortas y agradecidas.`,
      action_route: "crm", metric_value: noReply, metric_label: "reseñas",
    });
  }

  // 12. Opportunity — service with best margin and free capacity
  const best = [...ctx.services].sort((a, b) => Number(b.margen_bruto) - Number(a.margen_bruto))[0];
  if (best && best.margen_bruto > 0.4 && horas30 < goal * 0.8) {
    out.push({
      fingerprint: `opportunity:double_down:${best.servicio_nombre}`, category: "opportunity", urgency: "low",
      title: `Duplicá esfuerzo en ${best.servicio_nombre}`,
      why: `Tu servicio más rentable (${Math.round(best.margen_bruto * 100)}% de margen) y tenés capacidad libre.`,
      impact: `Es la palanca más eficiente de crecimiento este mes.`,
      action: `Vendé 2 unidades más este mes: reactivá clientes que ya lo compraron.`,
      action_route: "servicios",
    });
  }

  return out;
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
    const findings = detect(ctx);
    const foundFingerprints = new Set(findings.map((f) => f.fingerprint));

    // Auto-resolve previously open findings no longer detected
    const { data: openExisting } = await admin
      .from("business_blindspots")
      .select("id, fingerprint")
      .eq("user_id", userId)
      .is("dismissed_at", null)
      .is("resolved_at", null);
    const toResolve = (openExisting || []).filter((r: any) => !foundFingerprints.has(r.fingerprint));
    if (toResolve.length > 0) {
      await admin.from("business_blindspots").update({ resolved_at: new Date().toISOString() }).in("id", toResolve.map((r: any) => r.id));
    }

    // Upsert current findings
    if (findings.length > 0) {
      const rows = findings.map((f) => ({
        user_id: userId,
        fingerprint: f.fingerprint,
        category: f.category,
        urgency: f.urgency,
        title: f.title,
        why: f.why,
        impact: f.impact,
        action: f.action,
        entity_type: f.entity_type ?? null,
        entity_id: f.entity_id ?? null,
        action_route: f.action_route ?? null,
        metric_value: f.metric_value ?? null,
        metric_label: f.metric_label ?? null,
        detected_at: new Date().toISOString(),
        dismissed_at: null,
        resolved_at: null,
      }));
      const { error } = await admin.from("business_blindspots").upsert(rows, { onConflict: "user_id,fingerprint" });
      if (error) throw error;
    }

    const { data: current } = await admin
      .from("business_blindspots")
      .select("*")
      .eq("user_id", userId)
      .is("dismissed_at", null)
      .is("resolved_at", null)
      .order("urgency", { ascending: true })
      .order("detected_at", { ascending: false });

    return new Response(JSON.stringify({ ok: true, count: current?.length || 0, blindspots: current || [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("[bi-detect-blindspots]", err);
    return new Response(JSON.stringify({ ok: false, message: err instanceof Error ? err.message : String(err) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
