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

function decodeXml(input: string): string {
  return input
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function stripHtml(input: string): string {
  return decodeXml(input.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
}

function parseAtomPosts(xml: string, fallbackSubreddit: string, limit: number) {
  const entries = [...xml.matchAll(/<entry[\s\S]*?<\/entry>/g)].slice(0, limit);
  return entries.map((entry, index) => {
    const raw = entry[0];
    const title = decodeXml(raw.match(/<title[^>]*>([\s\S]*?)<\/title>/)?.[1] || '');
    const href = decodeXml(raw.match(/<link[^>]+href="([^"]+)"/)?.[1] || 'https://www.reddit.com');
    const author = decodeXml(raw.match(/<name>([\s\S]*?)<\/name>/)?.[1] || 'reddit');
    const updated = raw.match(/<updated>([\s\S]*?)<\/updated>/)?.[1] || new Date().toISOString();
    const content = stripHtml(raw.match(/<content[^>]*>([\s\S]*?)<\/content>/)?.[1] || '');
    const subreddit = href.match(/reddit\.com\/r\/([^/]+)/i)?.[1] || fallbackSubreddit;
    const id = raw.match(/<id>([\s\S]*?)<\/id>/)?.[1]?.split('/').filter(Boolean).pop() || `${subreddit}-${index}`;
    return {
      id,
      title,
      selftext: content.slice(0, 4000),
      author: author.replace(/^\/u\//, ''),
      subreddit,
      num_comments: 0,
      score: 0,
      upvote_ratio: 0,
      created_utc: Math.floor(new Date(updated).getTime() / 1000),
      url: href,
      link_flair_text: null,
      is_self: true,
    };
  });
}

function mapPullPushPosts(data: any[], limit: number) {
  return (data || []).slice(0, limit).map((p: any) => ({
    id: p.id || String(p.created_utc || crypto.randomUUID()),
    title: p.title || '',
    selftext: (p.selftext || p.body || '').slice(0, 4000),
    author: p.author || 'anon',
    subreddit: p.subreddit || '',
    num_comments: p.num_comments || 0,
    score: p.score || 0,
    upvote_ratio: p.upvote_ratio || 0,
    created_utc: p.created_utc || Math.floor(Date.now() / 1000),
    url: p.permalink ? `https://www.reddit.com${p.permalink}` : (p.full_link || p.url || 'https://www.reddit.com'),
    link_flair_text: p.link_flair_text || null,
    is_self: p.is_self ?? !!p.selftext,
  }));
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

    // Reddit recomienda identificar el cliente como "plataforma:app-id:version (by /u/usuario)"
    // en vez de simular un navegador -- un user-agent que finge ser Chrome/Firefox suele
    // disparar el rate-limiting/bloqueo de bots más rápido que uno transparente.
    const REDDIT_UA = 'web:ferova-crm-search:1.0.0 (by /u/ferova_agency)';

    const res = await fetch(url.toString(), {
      headers: {
        'User-Agent': REDDIT_UA,
        'Accept': 'application/json,text/plain,*/*',
      },
    });

    // Nota: se cae a los fallbacks tanto si la petición falla (!res.ok) como si
    // Reddit responde 200 con 0 resultados (búsqueda demasiado estrecha, o el
    // endpoint público de search.json simplemente no indexó nada reciente para
    // esa combinación de keywords) -- antes solo se activaba con !res.ok, así que
    // una búsqueda "vacía pero válida" nunca llegaba a los fallbacks más amplios.
    let primaryPosts: any[] = [];
    if (res.ok) {
      const data = await res.json();
      primaryPosts = (data?.data?.children || []).map((c: any) => {
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
    }

    if (primaryPosts.length > 0) {
      return new Response(JSON.stringify({ ok: true, query: q, count: primaryPosts.length, posts: primaryPosts, mode: 'reddit_search' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    {
      const arcticCollected: any[] = [];
      const arcticTargets = subreddits.length ? subreddits : ['SEO', 'digitalmarketing', 'ecommerce', 'shopify', 'marketing', 'Entrepreneur'];
      for (const keyword of keywords.slice(0, 6)) {
        for (const sub of arcticTargets.slice(0, 8)) {
          const arctic = new URL('https://arctic-shift.photon-reddit.com/api/posts/search');
          arctic.searchParams.set('query', keyword);
          arctic.searchParams.set('subreddit', sub.replace(/^r\//i, ''));
          arctic.searchParams.set('limit', String(Math.min(limit, 25)));
          arctic.searchParams.set('sort', 'desc');
          const arcticRes = await fetch(arctic.toString(), { headers: { 'Accept': 'application/json', 'User-Agent': 'FerovaOS/1.0' } });
          if (!arcticRes.ok) continue;
          const arcticJson = await arcticRes.json();
          arcticCollected.push(...mapPullPushPosts(arcticJson?.data || [], limit));
          if (arcticCollected.length >= limit) break;
        }
        if (arcticCollected.length >= limit) break;
      }
      if (arcticCollected.length) {
        const unique = Array.from(new Map(arcticCollected.map((p) => [p.url, p])).values()).slice(0, limit);
        return new Response(JSON.stringify({ ok: true, query: q, count: unique.length, posts: unique, mode: 'arctic_shift_fallback' }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const recentCollected: any[] = [];
      for (const sub of arcticTargets.slice(0, 8)) {
        const arctic = new URL('https://arctic-shift.photon-reddit.com/api/posts/search');
        arctic.searchParams.set('subreddit', sub.replace(/^r\//i, ''));
        arctic.searchParams.set('limit', String(Math.min(limit, 25)));
        arctic.searchParams.set('sort', 'desc');
        const arcticRes = await fetch(arctic.toString(), { headers: { 'Accept': 'application/json', 'User-Agent': 'FerovaOS/1.0' } });
        if (!arcticRes.ok) continue;
        const arcticJson = await arcticRes.json();
        const mapped = mapPullPushPosts(arcticJson?.data || [], limit);
        const filtered = mapped.filter((post) => {
          const haystack = `${post.title} ${post.selftext}`.toLowerCase();
          return keywords.some((keyword) => haystack.includes(keyword.toLowerCase()));
        });
        recentCollected.push(...(filtered.length ? filtered : mapped.slice(0, 2)));
        if (recentCollected.length >= limit) break;
      }
      if (recentCollected.length) {
        const unique = Array.from(new Map(recentCollected.map((p) => [p.url, p])).values()).slice(0, limit);
        return new Response(JSON.stringify({ ok: true, query: q, count: unique.length, posts: unique, mode: 'arctic_recent_fallback' }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const pullCollected: any[] = [];
      const pullTargets = subreddits.length ? subreddits : ['SEO', 'digitalmarketing', 'ecommerce', 'shopify', 'marketing', 'Entrepreneur'];
      for (const keyword of keywords.slice(0, 6)) {
        for (const sub of pullTargets.slice(0, 8)) {
          const pullpush = new URL('https://api.pullpush.io/reddit/search/submission/');
          pullpush.searchParams.set('q', keyword);
          pullpush.searchParams.set('subreddit', sub.replace(/^r\//i, ''));
          pullpush.searchParams.set('size', String(Math.min(limit, 25)));
          pullpush.searchParams.set('sort', 'desc');
          pullpush.searchParams.set('sort_type', 'created_utc');
          const pullRes = await fetch(pullpush.toString(), { headers: { 'Accept': 'application/json' } });
          if (!pullRes.ok) continue;
          const pullJson = await pullRes.json();
          pullCollected.push(...mapPullPushPosts(pullJson?.data || [], limit));
          if (pullCollected.length >= limit) break;
        }
        if (pullCollected.length >= limit) break;
      }
      if (pullCollected.length) {
        const unique = Array.from(new Map(pullCollected.map((p) => [p.url, p])).values()).slice(0, limit);
        return new Response(JSON.stringify({ ok: true, query: q, count: unique.length, posts: unique, mode: 'pullpush_fallback' }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const collected: any[] = [];
      const targets = subreddits.length ? subreddits : ['SEO', 'digitalmarketing', 'ecommerce', 'shopify', 'marketing', 'Entrepreneur'];
      for (const sub of targets.slice(0, 8)) {
        const rss = new URL(`https://www.reddit.com/r/${sub}/new/.rss`);
        rss.searchParams.set('limit', String(Math.min(limit, 25)));
        const rssRes = await fetch(rss.toString(), {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FerovaOS/1.0; +https://ferova.agency)', 'Accept': 'application/atom+xml,text/xml,*/*' },
        });
        if (!rssRes.ok) continue;
        const posts = parseAtomPosts(await rssRes.text(), sub, limit);
        collected.push(...posts.filter((post) => {
          const haystack = `${post.title} ${post.selftext}`.toLowerCase();
          return keywords.some((keyword) => haystack.includes(keyword.toLowerCase()));
        }));
        if (collected.length >= limit) break;
      }
      if (collected.length) {
        const unique = Array.from(new Map(collected.map((p) => [p.url, p])).values()).slice(0, limit);
        return new Response(JSON.stringify({ ok: true, query: q, count: unique.length, posts: unique, mode: 'rss_filtered_fallback' }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      // Si res.ok era true pero no vino ningún post (búsqueda válida pero vacía), el
      // body ya se leyó arriba con res.json() -- no volver a leerlo, solo reportar.
      const details = res.ok ? 'Reddit no devolvió resultados para esta combinación de palabras clave/subreddits.' : (await res.text()).slice(0, 300);
      console.error(`[reddit-search-keywords] sin resultados tras todos los fallbacks (status ${res.status})`);
      return new Response(JSON.stringify({
        ok: true,
        query: q,
        count: 0,
        posts: [],
        warning: 'Ninguna fuente (Reddit, arctic-shift, pullpush, RSS) devolvió publicaciones para estas palabras clave. Prueba con comunidades más específicas o menos/otras palabras clave.',
        details,
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
  } catch (err) {
    console.error('[reddit-search-keywords] error:', err);
    return new Response(JSON.stringify({ ok: false, message: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
