// Busca automáticamente oportunidades públicas de LinkedIn con motores públicos
// (sin credenciales nuevas) y devuelve resultados para analizar con IA manualmente.
// No envía mensajes ni interactúa con LinkedIn.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod';

const BodySchema = z.object({
  keywords: z.array(z.string().trim().min(1).max(80)).min(1).max(10),
  limit: z.number().int().min(1).max(30).default(12),
});

function decodeHtml(input: string): string {
  return input
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function extractDuckResults(html: string, limit: number) {
  const results: any[] = [];
  const blocks = [...html.matchAll(/<div[^>]+result__body[\s\S]*?(?=<div[^>]+result__body|<\/body>)/g)].map((m) => m[0]);
  for (const block of blocks) {
    const hrefRaw = block.match(/class="result__a"[^>]+href="([^"]+)"/)?.[1];
    const titleRaw = block.match(/class="result__a"[^>]*>([\s\S]*?)<\/a>/)?.[1];
    const snippetRaw = block.match(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/)?.[1]
      || block.match(/class="result__snippet"[^>]*>([\s\S]*?)<\/div>/)?.[1]
      || '';
    if (!hrefRaw || !titleRaw) continue;
    let url = decodeHtml(hrefRaw);
    try {
      const parsed = new URL(url, 'https://duckduckgo.com');
      const uddg = parsed.searchParams.get('uddg');
      if (uddg) url = decodeURIComponent(uddg);
    } catch { /**/ }
    if (!url.includes('linkedin.com/')) continue;
    const title = decodeHtml(titleRaw.replace(/<[^>]+>/g, ''));
    const snippet = decodeHtml(snippetRaw.replace(/<[^>]+>/g, ''));
    results.push({
      id: crypto.randomUUID(),
      title,
      snippet,
      url,
      author: title.split(' | ')[0]?.split(' - ')[0] || null,
      source: 'linkedin_public_search',
    });
    if (results.length >= limit) break;
  }
  return results;
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

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ ok: false, message: 'Parámetros inválidos', errors: parsed.error.flatten().fieldErrors }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { keywords, limit } = parsed.data;
    const query = `site:linkedin.com/posts OR site:linkedin.com/feed/update ${keywords.join(' ')}`;
    const url = new URL('https://html.duckduckgo.com/html/');
    url.searchParams.set('q', query);
    const res = await fetch(url.toString(), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; FerovaOS/1.0; +https://ferova.agency)',
        'Accept': 'text/html,*/*',
      },
    });
    if (!res.ok) {
      const text = await res.text();
      return new Response(JSON.stringify({ ok: false, message: `No pude buscar en LinkedIn público (${res.status})`, details: text.slice(0, 300) }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const results = extractDuckResults(await res.text(), limit);
    return new Response(JSON.stringify({ ok: true, query, count: results.length, results }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[linkedin-search-keywords] error:', err);
    return new Response(JSON.stringify({ ok: false, message: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});