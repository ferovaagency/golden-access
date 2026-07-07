import { createClient } from "jsr:@supabase/supabase-js@2";

// Verifica una orden de PayPal en el servidor antes de activar la suscripcion
// de Ferova OS Financiero. Nunca confia en el body del cliente para el monto
// ni para el user_id: el user_id sale del JWT ya verificado por Supabase
// (verify_jwt: true), y el estado/monto de la orden se re-consulta contra la
// API de PayPal usando credenciales de servidor (secrets).

const PAYPAL_CLIENT_ID = Deno.env.get("PAYPAL_CLIENT_ID");
const PAYPAL_CLIENT_SECRET = Deno.env.get("PAYPAL_CLIENT_SECRET");
const PAYPAL_ENV = (Deno.env.get("PAYPAL_ENV") || "live").toLowerCase();
const EXPECTED_AMOUNT_USD = Number(Deno.env.get("PAYPAL_EXPECTED_AMOUNT_USD") || "29.00");

const PAYPAL_API_BASE = PAYPAL_ENV === "sandbox"
  ? "https://api-m.sandbox.paypal.com"
  : "https://api-m.paypal.com";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function getPaypalAccessToken(): Promise<string> {
  if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
    throw new Error("PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET no configurados en los secrets de la funcion.");
  }
  const basicAuth = btoa(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`);
  const res = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) {
    throw new Error(`No se pudo autenticar con PayPal (${res.status}): ${await res.text()}`);
  }
  const data = await res.json();
  return data.access_token as string;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, message: "Method not allowed" }), { status: 405 });
  }

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace("Bearer ", "");

    // Cliente con el JWT del usuario, solo para resolver quien esta llamando
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser(jwt);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ ok: false, message: "No autenticado." }), { status: 401 });
    }
    const userId = userData.user.id;

    const { orderId } = await req.json();
    if (!orderId || typeof orderId !== "string") {
      return new Response(JSON.stringify({ ok: false, message: "Falta orderId." }), { status: 400 });
    }

    const accessToken = await getPaypalAccessToken();
    const orderRes = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders/${orderId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!orderRes.ok) {
      return new Response(JSON.stringify({ ok: false, message: `PayPal no encontro la orden (${orderRes.status}).` }), { status: 400 });
    }
    const order = await orderRes.json();

    if (order.status !== "COMPLETED") {
      return new Response(JSON.stringify({ ok: false, message: `La orden no esta completada (estado: ${order.status}).` }), { status: 400 });
    }

    const purchaseUnit = order.purchase_units?.[0];
    const capturedAmount = Number(
      purchaseUnit?.payments?.captures?.[0]?.amount?.value ?? purchaseUnit?.amount?.value ?? 0
    );
    if (!(capturedAmount >= EXPECTED_AMOUNT_USD)) {
      return new Response(
        JSON.stringify({ ok: false, message: `Monto capturado (${capturedAmount}) no coincide con el esperado (${EXPECTED_AMOUNT_USD}).` }),
        { status: 400 }
      );
    }

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { error: insertErr } = await adminClient.from("user_subscriptions").insert({
      user_id: userId,
      status: "active",
      provider: "paypal",
      provider_order_id: orderId,
      amount_usd: capturedAmount,
    });
    if (insertErr) {
      return new Response(JSON.stringify({ ok: false, message: `Error guardando suscripcion: ${insertErr.message}` }), { status: 500 });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, message: err instanceof Error ? err.message : String(err) }), { status: 500 });
  }
});
