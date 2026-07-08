// Busca publicaciones de Reddit por palabras clave (una o varias) usando la API JSON
// pública de búsqueda (sin OAuth). Puede restringir a una lista de subreddits o buscar en todo Reddit.
// Requiere sesión autenticada + membresía en crm_team_members.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod';

const BodySchema = z.object({
  keywords: z.array(z.string().trim().min(1).max(80)).min(1).max(10),
  subreddits: z.array(z.string().trim().min(1).max(60).regex(/^[A-Za-z0-9_]+$/)).max(15).optional().default([]),
  sort: z.enum(['relevance', 'new', 'hot', 'top', 'comments']).default('new'),
  timeframe: z.enum(['hour', 'day', 'week', 'month', 'year', 'all']).default('month'),
  limit: z.number().int().min(1).max(50).default(20),
});

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
    const { keywords, subreddits, sort, timeframe, limit } = parsed.data;

    // Build query: (kw1 OR kw2 OR ...) [subreddit:x OR subreddit:y]
    const kwPart = keywords.map((k) => `"${k.replace(/"/g, '')}"`).join(' OR ');
    const subPart = subreddits.length
      ? ' (' + subreddits.map((s) => `subreddit:${s.replace(/^r\//i, '')}`).join(' OR ') + ')'
      : '';
    const q = `(${kwPart})${subPart}`;

    const url = new URL('https://www.reddit.com/search.json');
    url.searchParams.set('q', q);
    url.searchParams.set('sort', sort);
    url.searchParams.set('t', timeframe);
    url.searchParams.set('limit', String(limit));
    url.searchParams.set('restrict_sr', 'false');

    const res = await fetch(url.toString(), {
      headers: { 'User-Agent': 'FerovaOS-CRM/1.0 (by u/ferova)' },
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`[reddit-search-keywords] Reddit ${res.status}: ${body.slice(0, 200)}`);
      return new Response(JSON.stringify({ ok: false, message: `Reddit devolvió ${res.status}`, details: body.slice(0, 300) }), {
        status: res.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await res.json();
    const posts = (data?.data?.children || []).map((c: any) => {
      const p = c.data || {};
      return {
        id: p.id,
        title: p.title || '',
        selftext: (p.selftext || '').slice(0, 4000),
        author: p.author || 'anon',
        subreddit: p.subreddit || '',
        num_comments: p.num_comments || 0,
        score: p.score || 0,
        upvote_ratio: p.upvote_ratio || 0,
        created_utc: p.created_utc || 0,
        url: `https://www.reddit.com${p.permalink}`,
        link_flair_text: p.link_flair_text || null,
        is_self: !!p.is_self,
      };
    });

    return new Response(JSON.stringify({ ok: true, query: q, count: posts.length, posts }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[reddit-search-keywords] error:', err);
    return new Response(JSON.stringify({ ok: false, message: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
