// Escanea Gmail del usuario conectado buscando notificaciones de leads del
// Radar de Sortlist (briefs de proyecto que la plataforma envía por email
// cuando hacen match con el perfil de Ferova), extrae con IA los datos del
// prospecto y los importa a crm_oportunidades. Mismo patrón que reviews-scan,
// pero para leads en vez de reseñas -- Sortlist no tiene una API pública para
// leer el Radar directamente, así que el correo de notificación es la única
// vía sin credenciales nuevas.
//
// Body: { access_token: string, days?: number }
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

interface Body {
  access_token?: string;
  days?: number;
}

const aiHeaders = (key: string) => ({
  'Content-Type': 'application/json',
  'Lovable-API-Key': key,
  'X-Lovable-AIG-SDK': 'manual-fetch',
});

const SENDER_DOMAIN = 'sortlist.com';

function buildQuery(days: number) {
  return `from:${SENDER_DOMAIN} newer_than:${days}d`;
}

function decodeBase64Url(data: string): string {
  try {
    const b64 = data.replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(b64.padEnd(b64.length + (4 - (b64.length % 4)) % 4, '='));
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return new TextDecoder('utf-8').decode(bytes);
  } catch {
    return '';
  }
}

function extractPlainText(payload: any): string {
  if (!payload) return '';
  if (payload.body?.data) {
    const text = decodeBase64Url(payload.body.data);
    if (payload.mimeType === 'text/html') {
      return text.replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    }
    return text;
  }
  if (payload.parts && Array.isArray(payload.parts)) {
    const plain = payload.parts.find((p: any) => p.mimeType === 'text/plain');
    if (plain) return extractPlainText(plain);
    const html = payload.parts.find((p: any) => p.mimeType === 'text/html');
    if (html) return extractPlainText(html);
    for (const p of payload.parts) {
      const t = extractPlainText(p);
      if (t) return t;
    }
  }
  return '';
}

function headerVal(headers: any[], name: string): string {
  const h = headers?.find((x: any) => x.name?.toLowerCase() === name.toLowerCase());
  return h?.value || '';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ ok: false, message: 'No autenticado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) {
      return new Response(JSON.stringify({ ok: false, message: 'Sesión inválida' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const { data: team } = await supabase.from('crm_team_members').select('email').eq('email', user.email).maybeSingle();
    if (!team) {
      return new Response(JSON.stringify({ ok: false, message: 'No autorizado' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = (await req.json()) as Body;
    const { data: savedConnection } = await supabase
      .from('google_workspace_connections')
      .select('access_token')
      .eq('user_id', user.id)
      .maybeSingle();
    const accessToken = body.access_token?.trim() || savedConnection?.access_token?.trim();
    if (!accessToken) {
      return new Response(JSON.stringify({ ok: false, message: 'Falta access_token de Google. Reconecta Google Workspace con permiso Gmail.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const days = Math.min(Math.max(body.days || 30, 1), 90);
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ ok: false, message: 'LOVABLE_API_KEY no configurada' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const q = encodeURIComponent(buildQuery(days));
    const listRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=50&q=${q}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!listRes.ok) {
      const t = await listRes.text();
      console.error(`[sortlist-leads-scan] gmail list ${listRes.status}: ${t}`);
      return new Response(JSON.stringify({ ok: false, message: 'Error consultando Gmail', status: listRes.status, details: t.slice(0, 500) }), {
        status: listRes.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const listJson = await listRes.json();
    const messages: { id: string }[] = listJson.messages || [];

    const ids = messages.map((m) => m.id);
    let existing: string[] = [];
    if (ids.length) {
      const { data } = await supabase.from('crm_oportunidades').select('email_message_id').in('email_message_id', ids);
      existing = (data || []).map((r: any) => r.email_message_id).filter(Boolean);
    }
    const pending = messages.filter((m) => !existing.includes(m.id));

    const inserted: any[] = [];
    let skipped = 0;

    for (const m of pending) {
      const msgRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=full`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!msgRes.ok) { skipped++; continue; }
      const msg = await msgRes.json();
      const headers = msg.payload?.headers || [];
      const subject = headerVal(headers, 'Subject');
      const from = headerVal(headers, 'From');
      const bodyText = extractPlainText(msg.payload).slice(0, 8000);

      const aiRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: aiHeaders(LOVABLE_API_KEY),
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            { role: 'system', content: `Eres un extractor. Recibirás asunto+cuerpo de un email que puede o no ser una notificación del "Radar" de Sortlist.com (avisa cuando un cliente publica un brief de proyecto que hace match con el perfil de la agencia). Devuelves EXCLUSIVAMENTE JSON:
{
  "es_lead": boolean (true SOLO si es una notificación de un brief/proyecto nuevo disponible para responder; false si es una reseña, un digest, marketing, o cualquier otra cosa),
  "nombre_contacto": string|null (nombre del cliente o de la empresa que publicó el brief, lo que esté disponible),
  "empresa": string|null,
  "resumen": string|null (descripción breve del proyecto/necesidad, tal cual aparece, sin firmas ni legales),
  "valor_estimado": number|null (presupuesto en la moneda que aparezca, solo el número),
  "moneda": string|null ("COP","USD","EUR", etc., null si no aparece),
  "ubicacion": string|null,
  "link": string|null (URL directa para VER o RESPONDER al brief en Sortlist)
}
Si no es una notificación de lead nuevo, pon es_lead=false y el resto null.` },
            { role: 'user', content: `De: ${from}\nAsunto: ${subject}\n\n${bodyText}` },
          ],
          response_format: { type: 'json_object' },
        }),
      });
      if (!aiRes.ok) {
        const t = await aiRes.text();
        console.error(`[sortlist-leads-scan] ai extraction ${aiRes.status}: ${t}`);
        return new Response(JSON.stringify({ ok: false, message: 'Error extrayendo leads con IA', status: aiRes.status, details: t.slice(0, 700) }), {
          status: aiRes.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const aiJson = await aiRes.json();
      const content = aiJson?.choices?.[0]?.message?.content;
      let parsed: any = {};
      try { parsed = JSON.parse(content); } catch { skipped++; continue; }
      if (!parsed.es_lead) { skipped++; continue; }

      const { data: ins, error: insErr } = await supabase.from('crm_oportunidades').insert({
        nombre_contacto: parsed.nombre_contacto || parsed.empresa || 'Lead de Sortlist',
        empresa: parsed.empresa || null,
        canal_origen: 'sortlist_radar',
        estado: 'nuevo',
        valor_estimado: typeof parsed.valor_estimado === 'number' ? parsed.valor_estimado : null,
        moneda: parsed.moneda || null,
        fuente_url: parsed.link || null,
        notas: [parsed.resumen, parsed.ubicacion].filter(Boolean).join(' · ') || null,
        email_message_id: m.id,
      }).select('*').single();
      if (insErr) { console.error('[sortlist-leads-scan] insert error', insErr); skipped++; continue; }
      inserted.push(ins);
    }

    return new Response(JSON.stringify({
      ok: true,
      scanned: messages.length,
      already_saved: existing.length,
      inserted: inserted.length,
      skipped,
      oportunidades: inserted,
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('[sortlist-leads-scan] error:', err);
    return new Response(JSON.stringify({ ok: false, message: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
