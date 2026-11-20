// Webhook de Whop (nov 2026). Mantiene user_subscriptions al día con las
// membresías de Whop.
//
// Eventos que se procesan:
//   payment.succeeded     → trae el correo del comprador, los metadatos del
//                           checkout y la membresía; se consulta la membresía y
//                           se activa / renueva el acceso.
//   membership.activated  → alta (incluida una prueba sin pago).
//   membership.updated    → cambios de estado: cancelación programada,
//                           cancelación efectiva, vencimiento, pago atrasado.
//   payment.failed        → sólo se registra (Whop reintenta el cobro y avisa
//                           por membership.updated si la membresía cambia).
//
// Quién es el comprador, en este orden:
//   1. La fila que ya existe para esa membresía (provider_order_id = mem_…).
//   2. metadata.supabase_user_id, que la app pone en el checkout embebido.
//   3. El correo del pago, buscado en auth.users (compras hechas en whop.com,
//      por ejemplo desde el enlace de un afiliado).
// Si nada coincide, el evento queda con outcome='unmatched' para revisarlo.
//
// Cambio de plan: Whop no cambia el plan de una membresía existente; la app
// abre el checkout del plan nuevo. Cuando la membresía nueva queda activa, las
// otras membresías activas de la misma persona se cancelan de inmediato aquí.
//
// verify_jwt=false: Whop no envía JWT de Supabase; la autenticidad se prueba
// con la firma (Standard Webhooks) antes de tocar la base.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { cancelMembership, ferovaPlanFor, getMembership, verifyWhopWebhook, whopConfigured, WhopError, type WhopMembership } from "../_shared/whop-api.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WEBHOOK_SECRET = (Deno.env.get("WHOP_WEBHOOK_SECRET") || "").trim();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ACCESS_STATUSES = new Set(["trialing", "active", "past_due"]);
const HANDLED = new Set(["payment.succeeded", "payment.failed", "membership.activated", "membership.updated"]);

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** USD cobrados en un pago, si vienen. Whop manda montos como objeto {amount: "20.00", currency}. */
function usdAmount(payment: any): number | null {
  const candidates = [payment?.usd_total, payment?.total, payment?.amount_charged];
  for (const c of candidates) {
    const raw = typeof c === "object" && c ? c.amount : c;
    const currency = typeof c === "object" && c ? String(c.currency || "usd").toLowerCase() : "usd";
    const value = Number(raw);
    if (currency === "usd" && Number.isFinite(value)) return value;
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, message: "Método no permitido." }, 405);
  if (!WEBHOOK_SECRET) return json({ ok: false, message: "Whop no está configurado en el servidor (WHOP_WEBHOOK_SECRET)." }, 503);

  const rawBody = await req.text();
  if (!(await verifyWhopWebhook(req.headers, rawBody, WEBHOOK_SECRET))) return json({ ok: false, message: "Firma inválida." }, 401);

  let event: any;
  try { event = JSON.parse(rawBody); } catch { return json({ ok: false, message: "Cuerpo inválido." }, 400); }

  const eventId = str(req.headers.get("webhook-id")) || str(event?.id);
  const eventType = str(event?.type) || "unknown";
  if (!eventId) return json({ ok: false, message: "Evento sin id." }, 400);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

  // Idempotencia: Whop puede repetir entregas.
  const { error: insertError } = await admin
    .from("billing_webhook_events")
    .insert({ provider: "whop", event_id: eventId, event_type: eventType, payload: event });
  if (insertError) {
    if (insertError.code === "23505") return json({ ok: true, duplicate: true });
    console.error("[whop-webhook] registro del evento", insertError);
    return json({ ok: false, message: "No fue posible registrar el evento." }, 500);
  }

  const outcome = (value: string) =>
    admin.from("billing_webhook_events").update({ outcome: value }).eq("provider", "whop").eq("event_id", eventId);

  async function fail(message: string, status = 500) {
    // Se borra el registro para que el reintento de Whop vuelva a procesarlo.
    await admin.from("billing_webhook_events").delete().eq("provider", "whop").eq("event_id", eventId);
    console.error("[whop-webhook]", message, { eventId, eventType });
    return json({ ok: false, message }, status);
  }

  if (!HANDLED.has(eventType)) {
    await outcome("ignored");
    return json({ ok: true, ignored: true });
  }

  const data = event?.data ?? {};
  if (eventType === "payment.failed") {
    console.warn("[whop-webhook] pago fallido", { membership: data?.membership_id, failure: data?.failure_message });
    await outcome("processed");
    return json({ ok: true, status: "payment_failed_logged" });
  }

  // --- Membresía afectada ---------------------------------------------------
  const isPayment = eventType === "payment.succeeded";
  const membershipId = isPayment ? str(data?.membership_id) : str(data?.id);
  if (!membershipId) {
    await outcome("ignored");
    return json({ ok: true, ignored: true, reason: "sin membresía" });
  }

  let membership: WhopMembership;
  try {
    // El pago no trae el estado de la membresía; los eventos de membresía sí,
    // pero se consulta igual para tener la versión más reciente.
    membership = whopConfigured() ? await getMembership(membershipId) : (isPayment ? null : data);
    if (!membership) return await fail("Falta WHOP_API_KEY para consultar la membresía.", 503);
  } catch (error) {
    if (!isPayment && error instanceof WhopError && error.status === 404) membership = data;
    else return await fail(`No fue posible consultar la membresía: ${error instanceof Error ? error.message : String(error)}`);
  }

  const whopPlanId = str(membership.variant_id) || str(membership.plan_id) || str(data?.variant_id) || str(data?.plan_id);
  const mapped = ferovaPlanFor(whopPlanId);
  if (!mapped) {
    // Un producto de Whop que no es Ferova One (o faltan los WHOP_PLAN_*).
    console.warn("[whop-webhook] plan de Whop sin equivalente en Ferova", { whopPlanId });
    await outcome("ignored");
    return json({ ok: true, ignored: true, reason: "plan desconocido" });
  }

  // --- Quién es -------------------------------------------------------------
  const { data: existing } = await admin
    .from("user_subscriptions")
    .select("id, user_id")
    .eq("provider", "whop")
    .eq("provider_order_id", membership.id)
    .maybeSingle();

  const metadata = { ...(membership.metadata ?? {}), ...(isPayment ? data?.metadata ?? {} : {}) } as Record<string, unknown>;
  let userId: string | null = existing?.user_id ?? null;
  if (!userId) {
    const fromMeta = str(metadata.supabase_user_id);
    if (fromMeta && UUID.test(fromMeta)) {
      const { data: found } = await admin.auth.admin.getUserById(fromMeta);
      if (found?.user) userId = found.user.id;
    }
  }
  if (!userId && isPayment) {
    const email = str(data?.customer_email) || str(data?.user?.email);
    if (email) {
      const { data: byEmail, error } = await admin.rpc("billing_user_id_by_email", { p_email: email });
      if (error) return await fail(`No fue posible buscar al comprador: ${error.message}`);
      if (typeof byEmail === "string") userId = byEmail;
    }
  }
  if (!userId) {
    await outcome("unmatched");
    console.warn("[whop-webhook] compra sin cuenta de Ferova", { membership: membership.id, eventType });
    return json({ ok: true, unmatched: true });
  }

  // --- Estado ---------------------------------------------------------------
  const hasAccess = ACCESS_STATUSES.has(String(membership.status));
  const periodEnd = str(membership.current_period_end);
  const row: Record<string, unknown> = {
    user_id: userId,
    status: hasAccess ? "active" : "cancelled",
    provider: "whop",
    provider_order_id: membership.id,
    provider_customer_id: str(membership.member_id) || str(membership.user_id),
    plan: mapped.plan,
    periodo: mapped.periodo,
    trial_ends_at: membership.status === "trialing" ? periodEnd : null,
    // Cancelación programada: el acceso sigue hasta el fin del período pagado.
    expires_at: hasAccess && membership.cancel_at_period_end ? (periodEnd || str(membership.expires_at)) : str(membership.expires_at),
  };
  if (isPayment) {
    const amount = usdAmount(data);
    if (amount !== null) row.amount_usd = amount;
  }

  const { error: upsertError } = await admin.from("user_subscriptions").upsert(row, { onConflict: "provider,provider_order_id" });
  if (upsertError) return await fail(`No fue posible guardar la suscripción: ${upsertError.message}`);

  // --- Cambio de plan: una sola membresía viva por persona -------------------
  if (hasAccess) {
    const { data: others } = await admin
      .from("user_subscriptions")
      .select("id, provider_order_id")
      .eq("user_id", userId)
      .eq("provider", "whop")
      .eq("status", "active")
      .neq("provider_order_id", membership.id);
    for (const other of others ?? []) {
      try {
        if (whopConfigured() && other.provider_order_id) await cancelMembership(other.provider_order_id, false);
      } catch (error) {
        // Ya cancelada o inexistente en Whop: igual se apaga aquí.
        console.warn("[whop-webhook] no se pudo cancelar la membresía anterior", other.provider_order_id, error instanceof Error ? error.message : error);
      }
      await admin.from("user_subscriptions").update({ status: "cancelled" }).eq("id", other.id);
    }
  }

  await outcome("processed");
  return json({ ok: true, status: row.status, plan: mapped.plan, periodo: mapped.periodo });
});
