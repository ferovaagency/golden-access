// PayPal webhook: signature verification via PayPal's own verify-webhook-signature
// endpoint, idempotency via paypal_webhook_events, then entitlement updates.
// verify_jwt=false because PayPal does not send Supabase JWTs; every event is
// verified against PayPal itself before any DB write.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const PAYPAL_CLIENT_ID = Deno.env.get('PAYPAL_CLIENT_ID') || '';
const PAYPAL_CLIENT_SECRET = Deno.env.get('PAYPAL_CLIENT_SECRET') || '';
const PAYPAL_WEBHOOK_ID = Deno.env.get('PAYPAL_WEBHOOK_ID') || '';
const PAYPAL_API_BASE = Deno.env.get('PAYPAL_API_BASE') || 'https://api-m.paypal.com';

function response(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

async function getPaypalAccessToken(): Promise<string | null> {
  const credentials = btoa(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`);
  const res = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${credentials}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  });
  const payload = await res.json().catch(() => null);
  return res.ok && typeof payload?.access_token === 'string' ? payload.access_token : null;
}

async function verifyPaypalSignature(req: Request, rawBody: string, accessToken: string): Promise<boolean> {
  const transmissionId = req.headers.get('paypal-transmission-id');
  const transmissionTime = req.headers.get('paypal-transmission-time');
  const transmissionSig = req.headers.get('paypal-transmission-sig');
  const certUrl = req.headers.get('paypal-cert-url');
  const authAlgo = req.headers.get('paypal-auth-algo');
  if (!transmissionId || !transmissionTime || !transmissionSig || !certUrl || !authAlgo || !PAYPAL_WEBHOOK_ID) return false;

  let webhookEvent: unknown;
  try { webhookEvent = JSON.parse(rawBody); } catch { return false; }

  const res = await fetch(`${PAYPAL_API_BASE}/v1/notifications/verify-webhook-signature`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      auth_algo: authAlgo,
      cert_url: certUrl,
      transmission_id: transmissionId,
      transmission_sig: transmissionSig,
      transmission_time: transmissionTime,
      webhook_id: PAYPAL_WEBHOOK_ID,
      webhook_event: webhookEvent,
    }),
  });
  const payload = await res.json().catch(() => null);
  return res.ok && payload?.verification_status === 'SUCCESS';
}

function statusForEvent(eventType: string): 'active' | 'cancelled' | null {
  if (eventType === 'BILLING.SUBSCRIPTION.ACTIVATED') return 'active';
  if (['BILLING.SUBSCRIPTION.CANCELLED', 'BILLING.SUBSCRIPTION.EXPIRED', 'BILLING.SUBSCRIPTION.SUSPENDED'].includes(eventType)) return 'cancelled';
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return response({ ok: false, message: 'Metodo no permitido.' }, 405);
  if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET || !PAYPAL_WEBHOOK_ID) {
    return response({ ok: false, message: 'PayPal no esta configurado en el servidor.' }, 503);
  }

  const rawBody = await req.text();
  const accessToken = await getPaypalAccessToken();
  if (!accessToken) {
    console.error('[paypal-webhook] no fue posible obtener access token de PayPal');
    return response({ ok: false, message: 'No fue posible autenticar contra PayPal.' }, 502);
  }
  const verified = await verifyPaypalSignature(req, rawBody, accessToken);
  if (!verified) return response({ ok: false, message: 'Firma invalida.' }, 401);

  let event: any;
  try { event = JSON.parse(rawBody); } catch { return response({ ok: false, message: 'Body invalido.' }, 400); }
  const eventId = typeof event?.id === 'string' ? event.id : null;
  const eventType = typeof event?.event_type === 'string' ? event.event_type : 'unknown';
  if (!eventId) return response({ ok: false, message: 'id de evento ausente.' }, 400);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  const { error: eventError } = await admin.from('paypal_webhook_events').insert({ event_id: eventId, event_type: eventType, payload: event });
  if (eventError) {
    if (eventError.code === '23505') return response({ ok: true, duplicate: true });
    console.error('[paypal-webhook] event insert failed', eventError);
    return response({ ok: false, message: 'No fue posible registrar el evento.' }, 500);
  }

  const mappedStatus = statusForEvent(eventType);
  if (!mappedStatus) return response({ ok: true, ignored: true });

  const subscriptionId = typeof event?.resource?.id === 'string' ? event.resource.id : null;
  if (!subscriptionId) {
    await admin.from('paypal_webhook_events').delete().eq('event_id', eventId);
    console.error('[paypal-webhook] evento sin id de suscripcion', { eventId, eventType });
    return response({ ok: false, message: 'Evento sin id de suscripcion.' }, 503);
  }

  const { error: updateError } = await admin
    .from('user_subscriptions')
    .update({ status: mappedStatus })
    .eq('provider', 'paypal')
    .eq('provider_order_id', subscriptionId);
  if (updateError) {
    await admin.from('paypal_webhook_events').delete().eq('event_id', eventId);
    console.error('[paypal-webhook] subscription update failed', updateError);
    return response({ ok: false, message: 'No fue posible actualizar el acceso.' }, 500);
  }

  return response({ ok: true });
});
