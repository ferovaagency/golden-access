// Inicia la prueba de 7 días SIN tarjeta (cardless trial de Paddle) en el plan
// que la persona eligió.
//
// Paddle no permite empezar estas pruebas desde su checkout: la crea el
// servidor con una transacción `billed` sobre un price que tiene
// trial_period.requires_payment_method=false. Paddle responde con la
// suscripción en estado "trialing" y, al vencer sin método de pago, la cancela
// sola (el webhook pone la fila en 'cancelled').
//
// Reglas:
//   · Una sola prueba por cuenta: si ya hubo una suscripción (viva o cancelada),
//     no se crea otra prueba; se responde con qué hacer (agregar tarjeta).
//   · Correos desechables no inician prueba.
//   · El acceso se da de inmediato con la fila en user_subscriptions; el webhook
//     (transaction.completed / subscription.trialing) la confirma después.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { ensureAddress, ensureCustomer, isDisposableEmail, paddle, paddleConfigured, PaddleError, priceIdFor } from "../_shared/paddle-api.ts";

const PLANES = ["basico", "intermedio", "full"] as const;
const PERIODOS = ["mensual", "anual"] as const;
const TRIAL_DAYS = 7;

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
    if (userError || !userData.user?.email) return json({ ok: false, message: "Sesión inválida." }, 401);
    const user = userData.user;
    const email = user.email as string;

    if (!paddleConfigured()) return json({ ok: false, code: "not_configured", message: "El servidor no tiene la API key de Paddle (PADDLE_API_KEY)." }, 503);

    const body = await req.json().catch(() => ({}));
    const plan = typeof body?.plan === "string" && (PLANES as readonly string[]).includes(body.plan) ? body.plan : null;
    const periodo = typeof body?.periodo === "string" && (PERIODOS as readonly string[]).includes(body.periodo) ? body.periodo : "mensual";
    const country = typeof body?.country === "string" && /^[A-Z]{2}$/.test(body.country) ? body.country : "CO";
    if (!plan) return json({ ok: false, message: "Elige un plan válido." }, 400);
    const priceId = priceIdFor(plan, periodo);
    if (!priceId) return json({ ok: false, message: "Ese plan aún no tiene precio configurado." }, 400);

    if (isDisposableEmail(email)) return json({ ok: false, code: "disposable_email", message: "Usa un correo real para iniciar la prueba." }, 400);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Una prueba por cuenta. Si ya existe cualquier suscripción, no se repite.
    const { data: previa } = await admin
      .from("user_subscriptions")
      .select("id, status, provider_order_id, trial_ends_at, expires_at, plan")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (previa) {
      const viva = previa.status === "active" && (!previa.expires_at || new Date(previa.expires_at) >= new Date());
      return json({
        ok: false,
        code: viva ? "already_active" : "trial_used",
        message: viva ? "Ya tienes una suscripción activa." : "Esta cuenta ya usó su prueba gratis. Agrega un método de pago para continuar.",
        subscription: previa,
      }, 409);
    }

    const name = (user.user_metadata?.full_name || user.user_metadata?.name || "") as string;
    const customerId = await ensureCustomer(email, name || null);
    const addressId = await ensureAddress(customerId, country);

    // Transacción facturada sobre el price con prueba sin tarjeta: Paddle crea
    // la suscripción en "trialing" sin pedir pago.
    const transaction = await paddle<{ id: string; subscription_id: string | null; status: string; billing_period?: { ends_at?: string } }>("POST", "/transactions", {
      items: [{ price_id: priceId, quantity: 1 }],
      customer_id: customerId,
      address_id: addressId,
      status: "billed",
      collection_mode: "automatic",
      custom_data: { user_id: user.id, plan, periodo, origen: "cardless_trial" },
    });

    const trialEnds = new Date(Date.now() + TRIAL_DAYS * 86_400_000).toISOString();
    const { error } = await admin.from("user_subscriptions").upsert({
      user_id: user.id,
      status: "active",
      provider: "paddle",
      provider_order_id: transaction.subscription_id || transaction.id,
      provider_customer_id: customerId,
      plan,
      periodo,
      trial_ends_at: trialEnds,
      amount_usd: 0,
    }, { onConflict: "provider,provider_order_id" });
    if (error) {
      console.error("[paddle-start-trial] upsert", error);
      return json({ ok: false, message: "Paddle creó la prueba pero no se pudo registrar el acceso. Reintenta en unos segundos." }, 500);
    }

    return json({ ok: true, plan, periodo, trial_ends_at: trialEnds, subscription_id: transaction.subscription_id, transaction_id: transaction.id });
  } catch (error) {
    if (error instanceof PaddleError) {
      console.error("[paddle-start-trial] paddle", error.status, error.code, error.message);
      return json({ ok: false, code: error.code, message: `Paddle: ${error.message}` }, 502);
    }
    console.error("[paddle-start-trial] error", error);
    return json({ ok: false, message: error instanceof Error ? error.message : String(error) }, 500);
  }
});
