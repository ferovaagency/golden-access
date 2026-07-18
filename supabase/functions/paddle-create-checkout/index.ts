// Creates a Paddle transaction for the caller. The browser never receives the
// Paddle API key or decides the price that will be billed.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const PADDLE_API_KEY = Deno.env.get('PADDLE_API_KEY') || '';
const PADDLE_PRICE_MAP_JSON = Deno.env.get('PADDLE_PRICE_MAP_JSON') || '';

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

function getPriceMap(): Record<string, string> | null {
  try {
    const value = JSON.parse(PADDLE_PRICE_MAP_JSON);
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const entries = Object.entries(value).filter(([plan, price]) => typeof plan === 'string' && typeof price === 'string' && price.startsWith('pri_'));
    return entries.length === Object.keys(value).length ? Object.fromEntries(entries) : null;
  } catch { return null; }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ message: 'Metodo no permitido.' }, 405);
  if (!PADDLE_API_KEY || !PADDLE_PRICE_MAP_JSON) return json({ message: 'Paddle no esta configurado en el servidor.' }, 503);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ message: 'Autenticacion requerida.' }, 401);
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } } });
  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) return json({ message: 'Sesion no valida.' }, 401);

  let body: { plan_code?: unknown };
  try { body = await req.json(); } catch { return json({ message: 'Solicitud invalida.' }, 400); }
  const priceMap = getPriceMap();
  const planCode = typeof body.plan_code === 'string' ? body.plan_code : '';
  const priceId = priceMap?.[planCode];
  if (!priceId) return json({ message: 'El plan solicitado no esta disponible.' }, 422);

  const paddleResponse = await fetch('https://api.paddle.com/transactions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${PADDLE_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      items: [{ price_id: priceId, quantity: 1 }],
      collection_mode: 'automatic',
      // Paddle propagates this metadata from a transaction to its subscription.
      custom_data: { ferova_user_id: user.id, ferova_plan_code: planCode },
    }),
  });
  const paddlePayload = await paddleResponse.json().catch(() => null);
  if (!paddleResponse.ok || typeof paddlePayload?.data?.id !== 'string') {
    console.error('[paddle-create-checkout] Paddle error', paddleResponse.status, paddlePayload);
    return json({ message: 'No fue posible crear la transaccion de pago.' }, 502);
  }
  return json({ transaction_id: paddlePayload.data.id });
});
