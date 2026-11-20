// Operaciones sobre la suscripción de Whop de la cuenta que pregunta:
//   · status → estado real de la membresía en Whop (para "Plan y suscripción").
//   · portal → enlace de Whop para administrar la membresía: método de pago,
//              facturas y cancelación. La cancelación pasa por el flujo de Whop
//              para que se apliquen las ofertas de retención configuradas allá.
//   · resume → deshace una cancelación programada para fin de período.
//
// Sólo se opera sobre la membresía guardada para el usuario autenticado; no se
// confía en ningún id que venga en la petición.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { getMembership, resumeMembership, safeManageUrl, whopConfigured, WhopError, type WhopMembership } from "../_shared/whop-api.ts";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" } });
}

/** Estado de Whop → estado que entiende la app (BillingStatus). */
function appStatus(status: string): "active" | "trialing" | "past_due" | "canceled" {
  if (status === "trialing") return "trialing";
  if (status === "active") return "active";
  if (status === "past_due" || status === "unresolved") return "past_due";
  return "canceled";
}

function summary(m: WhopMembership) {
  const end = m.current_period_end ?? null;
  const status = appStatus(String(m.status));
  return {
    ok: true,
    status,
    next_billed_at: status !== "canceled" && !m.cancel_at_period_end ? end : null,
    current_period_ends_at: end,
    cancel_at: m.cancel_at_period_end ? end : null,
    canceled_at: m.canceled_at ?? null,
    can_manage: !!safeManageUrl(m.manage_url),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, message: "Método no permitido." }, 405);
  try {
    const auth = req.headers.get("Authorization") || "";
    const token = auth.replace("Bearer ", "");
    if (!token) return json({ ok: false, message: "No autenticado." }, 401);
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: userData, error: userError } = await userClient.auth.getUser(token);
    if (userError || !userData.user) return json({ ok: false, message: "Sesión inválida." }, 401);
    const userId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "");
    if (!["status", "portal", "resume"].includes(action)) return json({ ok: false, message: "Acción no reconocida." }, 400);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: rows, error: rowsError } = await admin
      .from("user_subscriptions")
      .select("id, status, provider_order_id, created_at")
      .eq("user_id", userId)
      .eq("provider", "whop")
      .order("created_at", { ascending: false })
      .limit(10);
    if (rowsError) throw new Error("No se pudo consultar tu suscripción. Intenta de nuevo.");
    const row = (rows || []).find((r: any) => r.status === "active") || (rows || [])[0] || null;
    const membershipId: string | null = row?.provider_order_id && String(row.provider_order_id).startsWith("mem_") ? row.provider_order_id : null;

    if (!membershipId) {
      if (action === "status") return json({ ok: true, status: "none", next_billed_at: null, current_period_ends_at: null, cancel_at: null, canceled_at: null, can_manage: false });
      return json({ ok: false, code: "no_subscription", message: "No encontramos una suscripción. Si acabas de pagar, espera unos segundos y vuelve a intentarlo." }, 409);
    }
    if (!whopConfigured()) return json({ ok: false, code: "not_configured", message: "El servidor no tiene la API key de Whop (WHOP_API_KEY)." }, 503);

    if (action === "resume") {
      const m = await resumeMembership(membershipId);
      await admin.from("user_subscriptions").update({ expires_at: null }).eq("id", row.id);
      return json(summary(m));
    }

    const membership = await getMembership(membershipId);
    if (action === "status") return json(summary(membership));

    const url = safeManageUrl(membership.manage_url);
    if (!url) {
      return json({ ok: false, code: "no_manage_url", message: "Whop no devolvió el enlace de administración. Revisa que la API key tenga el permiso member:manage." }, 502);
    }
    return json({ ok: true, url });
  } catch (error) {
    if (error instanceof WhopError) {
      console.error("[whop-manage-subscription] whop", error.status, error.message);
      return json({ ok: false, message: `Whop: ${error.message}` }, 502);
    }
    console.error("[whop-manage-subscription] error", error);
    return json({ ok: false, message: error instanceof Error ? error.message : String(error) }, 500);
  }
});
