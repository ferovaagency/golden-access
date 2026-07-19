import { createClient } from "jsr:@supabase/supabase-js@2";

// Recibe la notificacion IPN (Instant Payment Notification) del boton alojado
// de suscripcion de PayPal (Paywall.tsx). No usa verify_jwt: PayPal nunca manda
// un JWT de Supabase. La autenticidad se verifica reenviando el mismo body a
// PayPal con cmd=_notify-validate (protocolo oficial de IPN) -- si PayPal no
// responde "VERIFIED", se ignora la notificacion.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PAYPAL_IPN_ENV = (Deno.env.get("PAYPAL_ENV") || "live").toLowerCase();
// Optional but recommended: without these, IPN authenticity is verified
// (the notification really came from PayPal) but not that it was paid to
// OUR account, in OUR currency, for at least the expected amount -- someone
// could otherwise replay a genuine-but-unrelated IPN of their own with a
// forged 'custom' field pointing at another user's account.
const PAYPAL_RECEIVER_EMAIL = (Deno.env.get("PAYPAL_RECEIVER_EMAIL") || "").trim().toLowerCase();
const PAYPAL_EXPECTED_CURRENCY = (Deno.env.get("PAYPAL_EXPECTED_CURRENCY") || "USD").toUpperCase();
const PAYPAL_MIN_AMOUNT_USD = Number(Deno.env.get("PAYPAL_EXPECTED_AMOUNT_USD") || "0") || 0;

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
    const receiverEmail = (params.get("receiver_email") || params.get("business") || "").trim().toLowerCase();
    const currency = (params.get("mc_currency") || "").toUpperCase();

    console.log("[paypal-ipn] verified event:", { txnType, paymentStatus, userId, txnId });

    if (!userId) {
      // Sin 'custom' no sabemos a que usuario de Supabase pertenece este evento
      return new Response("ok (no custom field)", { status: 200 });
    }

    const isActiveEvent = ACTIVE_TXN_TYPES.has(txnType) || paymentStatus === "Completed";

    if (isActiveEvent) {
      if (PAYPAL_RECEIVER_EMAIL && receiverEmail !== PAYPAL_RECEIVER_EMAIL) {
        console.warn("[paypal-ipn] receiver_email mismatch, ignoring:", receiverEmail);
        return new Response("ignored (receiver mismatch)", { status: 200 });
      }
      if (!PAYPAL_RECEIVER_EMAIL) console.warn("[paypal-ipn] PAYPAL_RECEIVER_EMAIL no configurado -- validando sin chequear receptor.");
      if (currency && currency !== PAYPAL_EXPECTED_CURRENCY) {
        console.warn("[paypal-ipn] currency mismatch, ignoring:", currency);
        return new Response("ignored (currency mismatch)", { status: 200 });
      }
      if (PAYPAL_MIN_AMOUNT_USD > 0 && (amount ?? 0) < PAYPAL_MIN_AMOUNT_USD) {
        console.warn("[paypal-ipn] amount below expected minimum, ignoring:", amount);
        return new Response("ignored (amount below minimum)", { status: 200 });
      }
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    if (isActiveEvent) {
      // upsert + ignoreDuplicates: PayPal redelivers IPNs (that's normal, not
      // an edge case), so the same txn_id must not create a second row.
      const { error: upsertErr } = await admin.from("user_subscriptions").upsert({
        user_id: userId,
        status: "active",
        provider: "paypal",
        provider_order_id: txnId,
        amount_usd: amount,
      }, { onConflict: "provider,provider_order_id", ignoreDuplicates: true });
      if (upsertErr) console.error("[paypal-ipn] upsert error:", upsertErr);
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
