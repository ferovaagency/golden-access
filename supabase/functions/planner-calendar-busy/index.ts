// Reads the connected user's Calendar only to reserve occupied intervals for
// the planner. The OAuth token comes from the current session and is never
// stored in Ferova's database.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ ok: false, message: 'Metodo no permitido.' }, 405);
  try {
    const authHeader = req.headers.get('Authorization') || '';
    const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error } = await client.auth.getUser();
    if (error || !user) return json({ ok: false, message: 'Sesion invalida.' }, 401);
    const body = await req.json();
    const date = typeof body?.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? body.date : new Date().toISOString().slice(0, 10);
    const token = typeof body?.access_token === 'string' ? body.access_token.trim() : '';
    if (!token) return json({ ok: false, message: 'Conecta Google Calendar para reservar sus eventos.' }, 400);
    const start = new Date(`${date}T00:00:00-05:00`).toISOString();
    const end = new Date(`${date}T23:59:59-05:00`).toISOString();
    const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?singleEvents=true&orderBy=startTime&timeMin=${encodeURIComponent(start)}&timeMax=${encodeURIComponent(end)}&maxResults=100`, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) return json({ ok: false, message: 'No se pudieron leer los eventos de Google Calendar.' }, response.status);
    const payload = await response.json();
    const blocks = (payload.items || []).filter((event: any) => event.status !== 'cancelled' && event.start?.dateTime && event.end?.dateTime).map((event: any) => ({ starts_at: event.start.dateTime, ends_at: event.end.dateTime, title: event.summary || 'Evento de Google Calendar' }));
    return json({ ok: true, blocks });
  } catch (error) {
    return json({ ok: false, message: error instanceof Error ? error.message : String(error) }, 500);
  }
});

function json(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); }
