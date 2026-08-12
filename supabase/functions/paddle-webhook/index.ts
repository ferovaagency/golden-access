// Webhook de Paddle Billing. Verifica la firma (Paddle-Signature: ts=..;h1=..)
// con HMAC-SHA256 sobre `${ts}:${rawBody}`, aplica idempotencia con
// paddle_webhook_events y luego actualiza la suscripción del usuario.
// verify_jwt=false: Paddle no envía JWT de Supabase; la autenticidad se prueba
// con la firma antes de tocar la base.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const WEBHOOK_SECRET = Deno.env.get('PADDLE_WEBHOOK_SECRET') || '';
const MAX_SKEW_SECONDS = 60 * 5;

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

function parseSignature(header: string | null): { ts: string; h1: string } | null {
  if (!header) return null;
  const parts = Object.fromEntries(
    header.split(';').map((chunk) => {
      const [key, ...rest] = chunk.split('=');
      return [key.trim(), rest.join('=').trim()];
    }),
  );
  return parts.ts && parts.h1 ? { ts: parts.ts, h1: parts.h1 } : null;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function verifySignature(header: string | null, rawBody: string): Promise<boolean> {
  if (!WEBHOOK_SECRET) return false;
  const parsed = parseSignature(header);
  if (!parsed) return false;
  const ts = Number(parsed.ts);
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > MAX_SKEW_SECONDS) return false;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(WEBHOOK_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signed = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${parsed.ts}:${rawBody}`));
  const expected = Array.from(new Uint8Array(signed)).map((b) => b.toString(16).padStart(2, '0')).join('');
  return timingSafeEqual(expected, parsed.h1.toLowerCase());
}

type Mapped = { status: 'active' | 'cancelled'; };

function statusForEvent(eventType: string): Mapped['status'] | null {
  if (['transaction.completed', 'subscription.activated', 'subscription.resumed'].includes(eventType)) return 'active';
  if (['subscription.canceled', 'subscription.cancelled', 'subscription.paused'].includes(eventType)) return 'cancelled';
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ ok: false, message: 'Metodo no permitido.' }, 405);
  if (!WEBHOOK_SECRET) return json({ ok: false, message: 'Paddle no esta configurado en el servidor.' }, 503);

  const rawBody = await req.text();
  const valid = await verifySignature(req.headers.get('paddle-signature'), rawBody);
  if (!valid) return json({ ok: false, message: 'Firma invalida.' }, 401);

  let event: any;
  try { event = JSON.parse(rawBody); } catch { return json({ ok: false, message: 'Body invalido.' }, 400); }

  const eventId: string | null = typeof event?.event_id === 'string' ? event.event_id : null;
  const eventType: string = typeof event?.event_type === 'string' ? event.event_type : 'unknown';
  if (!eventId) return json({ ok: false, message: 'id de evento ausente.' }, 400);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  const { error: eventError } = await admin
    .from('paddle_webhook_events')
    .insert({ event_id: eventId, event_type: eventType, payload: event });
  if (eventError) {
    if (eventError.code === '23505') return json({ ok: true, duplicate: true });
    console.error('[paddle-webhook] event insert failed', eventError);
    return json({ ok: false, message: 'No fue posible registrar el evento.' }, 500);
  }

  const mapped = statusForEvent(eventType);
  if (!mapped) return json({ ok: true, ignored: true });

  const data = event?.data ?? {};
  const customData = data?.custom_data ?? data?.transaction?.custom_data ?? {};
  const userId: string | null = typeof customData?.user_id === 'string' ? customData.user_id : null;
  const customerId: string | null = typeof data?.customer_id === 'string' ? data.customer_id : null;
  const subscriptionId: string | null =
    typeof data?.subscription_id === 'string' ? data.subscription_id : typeof data?.id === 'string' ? data.id : null;

  async function fail(message: string, status = 500) {
    // Se borra el registro de idempotencia para permitir el reintento de Paddle.
    await admin.from('paddle_webhook_events').delete().eq('event_id', eventId);
    console.error('[paddle-webhook]', message, { eventId, eventType });
    return json({ ok: false, message }, status);
  }

  if (mapped === 'active') {
    if (!userId) return await fail('Evento sin user_id en custom_data.', 400);
    const { error } = await admin.from('user_subscriptions').upsert(
      {
        user_id: userId,
        status: 'active',
        provider: 'paddle',
        provider_order_id: subscriptionId ?? eventId,
        provider_customer_id: customerId,
        plan: 'completo',
      },
      { onConflict: 'provider,provider_order_id' },
    );
    if (error) return await fail('No fue posible activar el acceso.');
    return json({ ok: true, status: 'active' });
  }

  // Cancelación: acota por la suscripción concreta y, si no viene, por el usuario.
  let query = admin.from('user_subscriptions').update({ status: 'cancelled' }).eq('provider', 'paddle');
  if (subscriptionId) query = query.eq('provider_order_id', subscriptionId);
  else if (userId) query = query.eq('user_id', userId);
  else return await fail('Evento de cancelacion sin identificadores.', 400);
  const { error: updateError } = await query;
  if (updateError) return await fail('No fue posible actualizar el acceso.');

  return json({ ok: true, status: 'cancelled' });
});
