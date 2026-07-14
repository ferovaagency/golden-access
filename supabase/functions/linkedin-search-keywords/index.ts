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

function extractBingResults(html: string, limit: number) {
  const results: any[] = [];
  const blocks = [...html.matchAll(/<li class="b_algo"[\s\S]*?(?=<li class="b_algo"|<\/ol>)/g)].map((m) => m[0]);
  for (const block of blocks) {
    const hrefRaw = block.match(/<h2[^>]*>\s*<a[^>]+href="([^"]+)"/)?.[1];
    const titleRaw = block.match(/<h2[^>]*>\s*<a[^>]*>([\s\S]*?)<\/a>/)?.[1];
    const snippetRaw = block.match(/class="b_caption"[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/)?.[1] || '';
    if (!hrefRaw || !titleRaw) continue;
    const url = decodeHtml(hrefRaw);
    if (!url.includes('linkedin.com/')) continue;
    const title = decodeHtml(titleRaw.replace(/<[^>]+>/g, ''));
    const snippet = decodeHtml(snippetRaw.replace(/<[^>]+>/g, ''));
    results.push({
      id: crypto.randomUUID(),
      title,
      snippet,
      url,
      author: title.split(' | ')[0]?.split(' - ')[0] || null,
      source: 'linkedin_public_search_bing',
    });
    if (results.length >= limit) break;
  }
  return results;
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

    // DuckDuckGo primero. Es un scraping de HTML de un buscador (no de LinkedIn en
    // sí), pero es frágil: el markup cambia y a veces bloquea peticiones automatizadas
    // devolviendo una página sin resultados reales (200 OK, 0 matches). En ese caso,
    // y también si la petición falla, se intenta con Bing como segunda fuente antes
    // de reportar error, en vez de quedarse con "no encontré nada".
    let results: any[] = [];
    let usedSource = 'duckduckgo';
    let lastError: string | null = null;

    try {
      const ddgUrl = new URL('https://html.duckduckgo.com/html/');
      ddgUrl.searchParams.set('q', query);
      const ddgRes = await fetch(ddgUrl.toString(), {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; FerovaOS/1.0; +https://ferova.agency)',
          'Accept': 'text/html,*/*',
        },
      });
      if (ddgRes.ok) {
        results = extractDuckResults(await ddgRes.text(), limit);
      } else {
        lastError = `DuckDuckGo ${ddgRes.status}`;
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }

    if (results.length === 0) {
      try {
        const bingUrl = new URL('https://www.bing.com/search');
        bingUrl.searchParams.set('q', query);
        bingUrl.searchParams.set('count', String(Math.min(limit * 2, 30)));
        const bingRes = await fetch(bingUrl.toString(), {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; FerovaOS/1.0; +https://ferova.agency)',
            'Accept': 'text/html,*/*',
          },
        });
        if (bingRes.ok) {
          results = extractBingResults(await bingRes.text(), limit);
          usedSource = 'bing';
        } else {
          lastError = lastError || `Bing ${bingRes.status}`;
        }
      } catch (err) {
        lastError = lastError || (err instanceof Error ? err.message : String(err));
      }
    }

    if (results.length === 0) {
      return new Response(JSON.stringify({
        ok: true,
        query,
        count: 0,
        results: [],
        source: usedSource,
        warning: 'Ningún buscador público devolvió resultados de LinkedIn para estas palabras clave. Esto puede pasar por bloqueo temporal del buscador o porque no hay publicaciones públicas indexadas recientes. Prueba con menos palabras clave, otras más específicas, o vuelve a intentar en unos minutos.',
        details: lastError,
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ ok: true, query, count: results.length, results, source: usedSource }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[linkedin-search-keywords] error:', err);
    return new Response(JSON.stringify({ ok: false, message: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});