// Confirms a PayPal subscription right after the browser's onApprove, without
// waiting for the webhook. The subscription id from the browser is never
// trusted on its own -- it's re-verified against PayPal's API using server
// credentials, and the user comes from the caller's verified Supabase JWT,
// never from the request body.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const PAYPAL_CLIENT_ID = Deno.env.get('PAYPAL_CLIENT_ID') || '';
const PAYPAL_CLIENT_SECRET = Deno.env.get('PAYPAL_CLIENT_SECRET') || '';
const PAYPAL_API_BASE = Deno.env.get('PAYPAL_API_BASE') || 'https://api-m.paypal.com';

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

async function getPaypalAccessToken(): Promise<string | null> {
  const credentials = btoa(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`);
  const response = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${credentials}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  });
  const payload = await response.json().catch(() => null);
  return response.ok && typeof payload?.access_token === 'string' ? payload.access_token : null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ message: 'Metodo no permitido.' }, 405);
  if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) return json({ message: 'PayPal no esta configurado en el servidor.' }, 503);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ message: 'Autenticacion requerida.' }, 401);
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } } });
  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) return json({ message: 'Sesion no valida.' }, 401);

  let body: { subscription_id?: unknown };
  try { body = await req.json(); } catch { return json({ message: 'Solicitud invalida.' }, 400); }
  const subscriptionId = typeof body.subscription_id === 'string' ? body.subscription_id.trim() : '';
  if (!subscriptionId) return json({ message: 'Falta el id de la suscripcion.' }, 400);

  const accessToken = await getPaypalAccessToken();
  if (!accessToken) {
    console.error('[paypal-confirm-subscription] no fue posible obtener access token de PayPal');
    return json({ message: 'No fue posible validar la suscripcion con PayPal.' }, 502);
  }

  const subResponse = await fetch(`${PAYPAL_API_BASE}/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const subscription = await subResponse.json().catch(() => null);
  if (!subResponse.ok || !subscription) {
    console.error('[paypal-confirm-subscription] PayPal error', subResponse.status, subscription);
    return json({ message: 'No fue posible consultar la suscripcion en PayPal.' }, 502);
  }
  if (subscription.status !== 'ACTIVE') {
    return json({ message: `La suscripcion todavia no esta activa en PayPal (status: ${subscription.status}).` }, 409);
  }

  // custom_id was set by the browser to the authenticated user's id when the
  // subscription was created -- cross-check it against the JWT user instead
  // of trusting either source alone.
  if (subscription.custom_id && subscription.custom_id !== user.id) {
    console.error('[paypal-confirm-subscription] custom_id no coincide con el usuario autenticado', { subscriptionId, customId: subscription.custom_id, userId: user.id });
    return json({ message: 'La suscripcion no corresponde a este usuario.' }, 403);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  const { error: upsertError } = await admin
    .from('user_subscriptions')
    .upsert(
      { user_id: user.id, status: 'active', provider: 'paypal', provider_order_id: subscriptionId, plan: 'completo' },
      { onConflict: 'provider,provider_order_id' },
    );
  if (upsertError) {
    console.error('[paypal-confirm-subscription] upsert failed', upsertError);
    return json({ message: 'No fue posible activar el acceso.' }, 500);
  }

  return json({ ok: true, status: 'active' });
});
