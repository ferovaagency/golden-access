// Escanea Gmail del usuario conectado buscando notificaciones de reseñas
// (Google Business, Clutch, Sortlist, GoodFirms, Trustpilot, DesignRush),
// extrae con IA plataforma/calificación/texto/reseñador/link y las guarda
// en crm_resenas. Requiere que el frontend envíe el access_token de Google
// del session.provider_token (scope gmail.readonly).
//
// Body: { access_token: string, days?: number }
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

interface Body {
  access_token?: string;
  days?: number;
}

const SENDERS = [
  'noreply-business@google.com',
  'noreply@business.google.com',
  'businessprofile-noreply@google.com',
  'clutch.co',
  'sortlist.com',
  'goodfirms.co',
  'trustpilot.com',
  'noreply@trustpilot.com',
  'designrush.com',
];

function buildQuery(days: number) {
  const from = SENDERS.map((s) => `from:${s}`).join(' OR ');
  return `(${from}) newer_than:${days}d`;
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
    const accessToken = body.access_token?.trim();
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

    // Lista de mensajes
    const q = encodeURIComponent(buildQuery(days));
    const listRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=50&q=${q}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!listRes.ok) {
      const t = await listRes.text();
      console.error(`[reviews-scan] gmail list ${listRes.status}: ${t}`);
      return new Response(JSON.stringify({ ok: false, message: 'Error consultando Gmail', status: listRes.status, details: t.slice(0, 500) }), {
        status: listRes.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const listJson = await listRes.json();
    const messages: { id: string }[] = listJson.messages || [];

    // Filtra los ya guardados
    const ids = messages.map((m) => m.id);
    let existing: string[] = [];
    if (ids.length) {
      const { data } = await supabase.from('crm_resenas').select('email_message_id').in('email_message_id', ids);
      existing = (data || []).map((r: any) => r.email_message_id);
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
      const dateHdr = headerVal(headers, 'Date');
      const detectedAt = dateHdr ? new Date(dateHdr).toISOString() : new Date().toISOString();

      // IA extracción
      const aiRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${LOVABLE_API_KEY}` },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            { role: 'system', content: `Eres un extractor. Recibirás asunto+cuerpo de un email de notificación de reseña (Google Business, Clutch, Sortlist, GoodFirms, Trustpilot, DesignRush). Devuelves EXCLUSIVAMENTE JSON:
{
  "es_resena": boolean,
  "plataforma": "google"|"clutch"|"sortlist"|"goodfirms"|"trustpilot"|"designrush"|"otro",
  "calificacion": number|null (1-5, null si no aparece),
  "texto": string|null (texto de la reseña tal cual, sin firmas/legales),
  "resenador": string|null (nombre del que dejó la reseña, sin "por"),
  "link": string|null (URL directa para RESPONDER o VER la reseña en la plataforma; prefiere links que contengan "review"/"reply"/"reviews")
}
Si el correo NO es una notificación de reseña recibida (por ejemplo digest, tips de marketing, resumen semanal sin reseña específica), pon es_resena=false y el resto null.` },
            { role: 'user', content: `De: ${from}\nAsunto: ${subject}\n\n${bodyText}` },
          ],
          response_format: { type: 'json_object' },
        }),
      });
      if (!aiRes.ok) { skipped++; continue; }
      const aiJson = await aiRes.json();
      const content = aiJson?.choices?.[0]?.message?.content;
      let parsed: any = {};
      try { parsed = JSON.parse(content); } catch { skipped++; continue; }
      if (!parsed.es_resena) { skipped++; continue; }

      const { data: ins, error: insErr } = await supabase.from('crm_resenas').insert({
        plataforma: (parsed.plataforma || 'otro').toString().toLowerCase(),
        calificacion: typeof parsed.calificacion === 'number' ? parsed.calificacion : null,
        texto: parsed.texto || null,
        resenador: parsed.resenador || null,
        link: parsed.link || null,
        email_message_id: m.id,
        email_subject: subject,
        email_from: from,
        detectada_en: detectedAt,
      }).select('*').single();
      if (insErr) { console.error('[reviews-scan] insert error', insErr); skipped++; continue; }
      inserted.push(ins);
    }

    return new Response(JSON.stringify({
      ok: true,
      scanned: messages.length,
      already_saved: existing.length,
      inserted: inserted.length,
      skipped,
      reviews: inserted,
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('[reviews-scan] error:', err);
    return new Response(JSON.stringify({ ok: false, message: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
