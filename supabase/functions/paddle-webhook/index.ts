// Paddle Billing webhook: signature verification, idempotency, and entitlement
// updates. This function deliberately has verify_jwt=false because Paddle does
// not send Supabase JWTs; its HMAC signature is verified before any DB write.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const WEBHOOK_SECRET = Deno.env.get('PADDLE_WEBHOOK_SECRET') || '';
const PADDLE_PRICE_MAP_JSON = Deno.env.get('PADDLE_PRICE_MAP_JSON') || '';

function response(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function getPriceMap(): Record<string, string> | null {
  try {
    const value = JSON.parse(PADDLE_PRICE_MAP_JSON);
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const entries = Object.entries(value).filter(([plan, price]) => typeof plan === 'string' && typeof price === 'string' && price.startsWith('pri_'));
    return entries.length === Object.keys(value).length ? Object.fromEntries(entries) : null;
  } catch { return null; }
}

async function verifyPaddleSignature(rawBody: string, signatureHeader: string, secret: string): Promise<boolean> {
  try {
    const pairs = signatureHeader.split(';').map((part) => part.split('='));
    const parts = Object.fromEntries(pairs);
    const timestamp = parts.ts;
    const signature = parts.h1;
    if (!timestamp || !signature) return false;
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const value = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestamp}:${rawBody}`));
    const expected = Array.from(new Uint8Array(value)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
    if (expected.length !== signature.length) return false;
    let difference = 0;
    for (let index = 0; index < expected.length; index += 1) difference |= expected.charCodeAt(index) ^ signature.charCodeAt(index);
    return difference === 0;
  } catch { return false; }
}

function statusForEvent(eventType: string, paddleStatus?: unknown): 'active' | 'pending' | 'cancelled' | null {
  if (eventType === 'transaction.completed' || ['subscription.activated', 'subscription.resumed', 'subscription.trialing'].includes(eventType)) return 'active';
  if (eventType === 'subscription.canceled') return 'cancelled';
  if (eventType === 'subscription.paused' || eventType === 'subscription.past_due') return 'pending';
  if (eventType !== 'subscription.updated' || typeof paddleStatus !== 'string') return null;
  if (['active', 'trialing'].includes(paddleStatus)) return 'active';
  if (['paused', 'past_due'].includes(paddleStatus)) return 'pending';
  if (['canceled', 'cancelled'].includes(paddleStatus)) return 'cancelled';
  return null;
}

function priceIdFromEvent(data: Record<string, any>): string | null {
  const items = Array.isArray(data.items) ? data.items : Array.isArray(data.details?.line_items) ? data.details.line_items : [];
  const item = items[0];
  const priceId = item?.price_id ?? item?.price?.id;
  return typeof priceId === 'string' ? priceId : null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return response({ ok: false, message: 'Metodo no permitido.' }, 405);
  if (!WEBHOOK_SECRET) return response({ ok: false, message: 'PADDLE_WEBHOOK_SECRET no configurado.' }, 503);

  const rawBody = await req.text();
  const signed = await verifyPaddleSignature(rawBody, req.headers.get('paddle-signature') || '', WEBHOOK_SECRET);
  if (!signed) return response({ ok: false, message: 'Firma invalida.' }, 401);

  let event: any;
  try { event = JSON.parse(rawBody); } catch { return response({ ok: false, message: 'Body invalido.' }, 400); }
  const eventId = typeof event?.event_id === 'string' ? event.event_id : null;
  const eventType = typeof event?.event_type === 'string' ? event.event_type : 'unknown';
  if (!eventId) return response({ ok: false, message: 'event_id ausente.' }, 400);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  const { error: eventError } = await admin.from('paddle_webhook_events').insert({ event_id: eventId, event_type: eventType, payload: event });
  if (eventError) {
    if (eventError.code === '23505') return response({ ok: true, duplicate: true });
    console.error('[paddle-webhook] event insert failed', eventError);
    return response({ ok: false, message: 'No fue posible registrar el evento.' }, 500);
  }

  const data = event?.data && typeof event.data === 'object' ? event.data as Record<string, any> : {};
  const mappedStatus = statusForEvent(eventType, data.status);
  if (!mappedStatus) return response({ ok: true, ignored: true });

  const userId = typeof data.custom_data?.ferova_user_id === 'string' ? data.custom_data.ferova_user_id : null;
  const priceId = priceIdFromEvent(data);
  const priceMap = getPriceMap();
  const isRecognizedPrice = Boolean(priceId && priceMap && Object.values(priceMap).includes(priceId));
  if (!userId || !isRecognizedPrice) {
    // Remove the idempotency entry so Paddle can retry after configuration is fixed.
    await admin.from('paddle_webhook_events').delete().eq('event_id', eventId);
    console.error('[paddle-webhook] missing secure entitlement context', { eventId, eventType, userId, priceId });
    return response({ ok: false, message: 'Evento sin contexto de acceso valido.' }, 503);
  }

  const providerOrderId = typeof data.id === 'string' ? data.id : eventId;
  // Paddle's customer id (ctm_...), present on transaction/subscription events.
  // Stored so authenticated in-app pages can init Paddle.js with pwCustomer
  // and get Retain's payment-recovery/cancellation-flow features.
  const customerId = typeof data.customer_id === 'string' ? data.customer_id : null;
  const { data: existingRows, error: lookupError } = await admin
    .from('user_subscriptions')
    .select('id')
    .eq('user_id', userId)
    .eq('provider', 'paddle')
    .order('created_at', { ascending: false })
    .limit(1);

  let subscriptionError = lookupError;
  if (!subscriptionError && existingRows?.[0]) {
    const update: Record<string, unknown> = { status: mappedStatus, provider_order_id: providerOrderId };
    if (customerId) update.provider_customer_id = customerId;
    const { error } = await admin.from('user_subscriptions').update(update).eq('id', existingRows[0].id);
    subscriptionError = error;
  } else if (!subscriptionError && mappedStatus !== 'cancelled') {
    const { error } = await admin.from('user_subscriptions').insert({ user_id: userId, status: mappedStatus, provider: 'paddle', provider_order_id: providerOrderId, provider_customer_id: customerId, amount_usd: null });
    subscriptionError = error;
  }

  if (subscriptionError) {
    await admin.from('paddle_webhook_events').delete().eq('event_id', eventId);
    console.error('[paddle-webhook] subscription update failed', subscriptionError);
    return response({ ok: false, message: 'No fue posible actualizar el acceso.' }, 500);
  }

  return response({ ok: true });
});
