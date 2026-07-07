import { createClient } from "jsr:@supabase/supabase-js@2";

// Recibe la notificacion IPN (Instant Payment Notification) del boton alojado
// de suscripcion de PayPal (Paywall.tsx). No usa verify_jwt: PayPal nunca manda
// un JWT de Supabase. La autenticidad se verifica reenviando el mismo body a
// PayPal con cmd=_notify-validate (protocolo oficial de IPN) -- si PayPal no
// responde "VERIFIED", se ignora la notificacion.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PAYPAL_IPN_ENV = (Deno.env.get("PAYPAL_ENV") || "live").toLowerCase();

const IPN_VERIFY_URL = PAYPAL_IPN_ENV === "sandbox"
  ? "https://ipnpb.sandbox.paypal.com/cgi-bin/webscr"
  : "https://ipnpb.paypal.com/cgi-bin/webscr";

const ACTIVE_TXN_TYPES = new Set(["subscr_signup", "subscr_payment"]);
const CANCEL_TXN_TYPES = new Set(["subscr_cancel", "subscr_eot", "subscr_failed"]);

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("method not allowed", { status: 405 });
  }

  const bodyText = await req.text();

  try {
    const verifyRes = await fetch(IPN_VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `cmd=_notify-validate&${bodyText}`,
    });
    const verification = (await verifyRes.text()).trim();

    if (verification !== "VERIFIED") {
      console.warn("[paypal-ipn] not verified by PayPal:", verification);
      return new Response("ignored", { status: 200 });
    }

    const params = new URLSearchParams(bodyText);
    const txnType = params.get("txn_type") || "";
    const paymentStatus = params.get("payment_status") || "";
    const userId = params.get("custom") || "";
    const txnId = params.get("txn_id") || params.get("subscr_id") || null;
    const amount = Number(params.get("mc_gross") || params.get("amount") || 0) || null;

    console.log("[paypal-ipn] verified event:", { txnType, paymentStatus, userId, txnId });

    if (!userId) {
      // Sin 'custom' no sabemos a que usuario de Supabase pertenece este evento
      return new Response("ok (no custom field)", { status: 200 });
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    if (ACTIVE_TXN_TYPES.has(txnType) || paymentStatus === "Completed") {
      await admin.from("user_subscriptions").insert({
        user_id: userId,
        status: "active",
        provider: "paypal",
        provider_order_id: txnId,
        amount_usd: amount,
      });
    } else if (CANCEL_TXN_TYPES.has(txnType) || paymentStatus === "Denied" || paymentStatus === "Failed") {
      await admin.from("user_subscriptions").update({ status: "cancelled" }).eq("user_id", userId).eq("status", "active");
    }

    return new Response("ok", { status: 200 });
  } catch (err) {
    console.error("[paypal-ipn] error:", err);
    // Responder 200 igual: PayPal reintenta si no recibe 200, y no queremos un loop de reintentos por un error nuestro
    return new Response("error logged", { status: 200 });
  }
});
