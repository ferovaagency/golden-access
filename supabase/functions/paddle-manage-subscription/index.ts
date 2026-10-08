// Operaciones sobre la suscripción de Paddle de la cuenta que pregunta:
//   · payment_method → transacción para agregar/cambiar tarjeta (Paddle la
//     exige en checkout de una página). Es lo que convierte una prueba sin
//     tarjeta en una suscripción que se renueva, y lo que reactiva una prueba
//     vencida.
//   · change_plan → cambia el price de la suscripción (sube o baja de plan,
//     o cambia mensual/anual) con prorrateo inmediato. Si Paddle exige método
//     de pago primero, se responde con code "payment_method_required".
//   · status → estado real en Paddle (trialing / active / canceled…).
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { paddle, paddleConfigured, PaddleError, priceIdFor } from "../_shared/paddle-api.ts";

const PLANES = ["basico", "intermedio", "full"] as const;
const PERIODOS = ["mensual", "anual"] as const;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
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
    if (!paddleConfigured()) return json({ ok: false, code: "not_configured", message: "El servidor no tiene la API key de Paddle (PADDLE_API_KEY)." }, 503);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await req.json().catch(() => ({}));
    const action = body?.action as string;

    // La suscripción de Paddle de esta persona: la fila más reciente cuyo
    // provider_order_id sea un id de suscripción (sub_…). Las filas con id de
    // transacción (txn_…) no sirven para operar.
    const { data: rows } = await admin
      .from("user_subscriptions")
      .select("id, status, provider_order_id, provider_customer_id, plan, periodo, trial_ends_at")
      .eq("user_id", userId)
      .eq("provider", "paddle")
      .order("created_at", { ascending: false })
      .limit(10);
    let subscriptionId = (rows || []).map((r: any) => r.provider_order_id as string).find((id) => id?.startsWith("sub_")) || null;
    const customerId = (rows || []).map((r: any) => r.provider_customer_id as string | null).find(Boolean) || null;

    // Si sólo tenemos el id de la transacción (prueba recién creada y el
    // webhook aún no llegó), se busca la suscripción por cliente en Paddle.
    if (!subscriptionId && customerId) {
      const subs = await paddle<Array<{ id: string; status: string }>>("GET", `/subscriptions?customer_id=${customerId}&per_page=5`);
      subscriptionId = (subs || []).find((s) => ["trialing", "active", "past_due", "paused"].includes(s.status))?.id || (subs || [])[0]?.id || null;
    }
    if (!subscriptionId) return json({ ok: false, code: "no_subscription", message: "No encontramos una suscripción de Paddle para esta cuenta." }, 404);

    if (action === "status") {
      const sub = await paddle<{ id: string; status: string; next_billed_at: string | null; items: Array<{ price: { id: string } }> }>("GET", `/subscriptions/${subscriptionId}`);
      return json({ ok: true, subscription_id: sub.id, status: sub.status, next_billed_at: sub.next_billed_at, price_id: sub.items?.[0]?.price?.id ?? null });
    }

    if (action === "payment_method") {
      const txn = await paddle<{ id: string }>("GET", `/subscriptions/${subscriptionId}/update-payment-method-transaction`);
      return json({ ok: true, transaction_id: txn.id, subscription_id: subscriptionId });
    }

    if (action === "change_plan") {
      const plan = typeof body?.plan === "string" && (PLANES as readonly string[]).includes(body.plan) ? body.plan : null;
      const periodo = typeof body?.periodo === "string" && (PERIODOS as readonly string[]).includes(body.periodo) ? body.periodo : "mensual";
      if (!plan) return json({ ok: false, message: "Elige un plan válido." }, 400);
      const priceId = priceIdFor(plan, periodo);
      if (!priceId) return json({ ok: false, message: "Ese plan aún no tiene precio configurado." }, 400);
      try {
        const sub = await paddle<{ id: string; status: string }>("PATCH", `/subscriptions/${subscriptionId}`, {
          items: [{ price_id: priceId, quantity: 1 }],
          proration_billing_mode: "prorated_immediately",
          custom_data: { user_id: userId, plan, periodo },
        });
        // El webhook (subscription.updated no cambia estado) no toca el plan:
        // se actualiza aquí para que la app lo refleje de inmediato.
        await admin.from("user_subscriptions").update({ plan, periodo }).eq("user_id", userId).eq("provider", "paddle").eq("status", "active");
        return json({ ok: true, subscription_id: sub.id, status: sub.status, plan, periodo });
      } catch (error) {
        if (error instanceof PaddleError && /payment method|payment_method/i.test(`${error.code} ${error.message}`)) {
          const txn = await paddle<{ id: string }>("GET", `/subscriptions/${subscriptionId}/update-payment-method-transaction`);
          return json({ ok: false, code: "payment_method_required", message: "Para cambiar de plan primero agrega un método de pago.", transaction_id: txn.id }, 409);
        }
        throw error;
      }
    }

    return json({ ok: false, message: "Acción no reconocida." }, 400);
  } catch (error) {
    if (error instanceof PaddleError) {
      console.error("[paddle-manage-subscription] paddle", error.status, error.code, error.message);
      return json({ ok: false, code: error.code, message: `Paddle: ${error.message}` }, 502);
    }
    console.error("[paddle-manage-subscription] error", error);
    return json({ ok: false, message: error instanceof Error ? error.message : String(error) }, 500);
  }
});
