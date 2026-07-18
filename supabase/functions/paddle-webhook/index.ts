// Webhook de Paddle Billing con verificación de firma (HMAC) e idempotencia.
// Mientras `PADDLE_WEBHOOK_SECRET` esté vacío el endpoint devuelve 503
// (`awaiting_configuration`) para no aceptar eventos sin firma válida.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const WEBHOOK_SECRET = Deno.env.get('PADDLE_WEBHOOK_SECRET') || '';

async function verifyPaddleSignature(rawBody: string, sigHeader: string, secret: string): Promise<boolean> {
  // Formato Paddle Billing: "ts=...;h1=<hex>"
  try {
    const parts = Object.fromEntries(sigHeader.split(';').map((p) => p.split('=')));
    const ts = parts['ts'];
    const h1 = parts['h1'];
    if (!ts || !h1) return false;
    const payload = `${ts}:${rawBody}`;
    const key = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
    );
    const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
    const hex = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
    // comparación en tiempo constante
    if (hex.length !== h1.length) return false;
    let diff = 0;
    for (let i = 0; i < hex.length; i++) diff |= hex.charCodeAt(i) ^ h1.charCodeAt(i);
    return diff === 0;
  } catch { return false; }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  if (!WEBHOOK_SECRET) {
    return new Response(JSON.stringify({ ok: false, status: 'awaiting_configuration', message: 'PADDLE_WEBHOOK_SECRET no configurado.' }), {
      status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const rawBody = await req.text();
  const sig = req.headers.get('paddle-signature') || '';
  const ok = await verifyPaddleSignature(rawBody, sig, WEBHOOK_SECRET);
  if (!ok) {
    return new Response(JSON.stringify({ ok: false, message: 'Firma inválida' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let event: any;
  try { event = JSON.parse(rawBody); }
  catch {
    return new Response(JSON.stringify({ ok: false, message: 'Body inválido' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const eventId: string | undefined = event?.event_id || event?.data?.id;
  const eventType: string = event?.event_type || 'unknown';
  if (!eventId) {
    return new Response(JSON.stringify({ ok: false, message: 'event_id ausente' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

  // Idempotencia: si el event_id ya se procesó, devolvemos 200.
  const { error: insertErr } = await admin.from('paddle_webhook_events').insert({
    event_id: eventId, event_type: eventType, payload: event,
  });
  if (insertErr) {
    if (insertErr.code === '23505') {
      return new Response(JSON.stringify({ ok: true, duplicate: true }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    console.error('[paddle-webhook] insert error', insertErr);
    return new Response(JSON.stringify({ ok: false, message: insertErr.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Mapeo mínimo a `user_subscriptions`. La lógica detallada se completa
  // cuando el proveedor esté productivo; aquí sólo garantizamos la escritura.
  try {
    const email: string | undefined = event?.data?.customer?.email || event?.data?.email;
    if (email && ['subscription.created', 'subscription.activated', 'transaction.completed'].includes(eventType)) {
      const { data: userRow } = await admin.rpc('get_user_id_by_email', { p_email: email }).maybeSingle?.() ?? { data: null };
      const userId = (userRow as any)?.id;
      if (userId) {
        await admin.from('user_subscriptions').upsert({
          user_id: userId, status: 'active', provider: 'paddle', amount_usd: 50,
        }, { onConflict: 'user_id' });
      }
    }
  } catch (err) {
    console.warn('[paddle-webhook] no se pudo mapear entitlement:', (err as Error).message);
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
