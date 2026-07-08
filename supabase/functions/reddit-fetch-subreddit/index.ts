// Trae publicaciones recientes de un subreddit vía la API JSON pública de Reddit (sin OAuth).
// Requiere sesión autenticada + membresía en crm_team_members.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod';

const BodySchema = z.object({
  subreddit: z.string().trim().min(1).max(60).regex(/^[A-Za-z0-9_]+$/, 'Nombre de subreddit inválido'),
  listing: z.enum(['new', 'hot', 'top', 'rising']).default('new'),
  limit: z.number().int().min(1).max(50).default(15),
  timeframe: z.enum(['hour', 'day', 'week', 'month', 'year', 'all']).default('week'),
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

function parseAtomPosts(xml: string, cleanSub: string, limit: number) {
  const entries = [...xml.matchAll(/<entry[\s\S]*?<\/entry>/g)].slice(0, limit);
  return entries.map((entry, index) => {
    const raw = entry[0];
    const title = decodeXml(raw.match(/<title[^>]*>([\s\S]*?)<\/title>/)?.[1] || '');
    const href = decodeXml(raw.match(/<link[^>]+href="([^"]+)"/)?.[1] || `https://www.reddit.com/r/${cleanSub}`);
    const author = decodeXml(raw.match(/<name>([\s\S]*?)<\/name>/)?.[1] || 'reddit');
    const updated = raw.match(/<updated>([\s\S]*?)<\/updated>/)?.[1] || new Date().toISOString();
    const content = stripHtml(raw.match(/<content[^>]*>([\s\S]*?)<\/content>/)?.[1] || '');
    const id = raw.match(/<id>([\s\S]*?)<\/id>/)?.[1]?.split('/').filter(Boolean).pop() || `${cleanSub}-${index}`;
    return {
      id,
      title,
      selftext: content.slice(0, 4000),
      author: author.replace(/^\/u\//, ''),
      subreddit: cleanSub,
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

function mapPullPushPosts(data: any[], cleanSub: string, limit: number) {
  return (data || []).slice(0, limit).map((p: any) => ({
    id: p.id || String(p.created_utc || crypto.randomUUID()),
    title: p.title || '',
    selftext: (p.selftext || p.body || '').slice(0, 4000),
    author: p.author || 'anon',
    subreddit: p.subreddit || cleanSub,
    num_comments: p.num_comments || 0,
    score: p.score || 0,
    upvote_ratio: p.upvote_ratio || 0,
    created_utc: p.created_utc || Math.floor(Date.now() / 1000),
    url: p.permalink ? `https://www.reddit.com${p.permalink}` : (p.full_link || p.url || `https://www.reddit.com/r/${cleanSub}`),
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
    const { subreddit, listing, limit, timeframe } = parsed.data;

    const cleanSub = subreddit.replace(/^r\//i, '');
    const url = new URL(`https://www.reddit.com/r/${cleanSub}/${listing}.json`);
    url.searchParams.set('limit', String(limit));
    if (listing === 'top') url.searchParams.set('t', timeframe);

    const res = await fetch(url.toString(), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; FerovaOS/1.0; +https://ferova.agency)',
        'Accept': 'application/json,text/plain,*/*',
      },
    });

    if (!res.ok) {
      const arctic = new URL('https://arctic-shift.photon-reddit.com/api/posts/search');
      arctic.searchParams.set('subreddit', cleanSub);
      arctic.searchParams.set('limit', String(limit));
      arctic.searchParams.set('sort', 'desc');
      const arcticRes = await fetch(arctic.toString(), { headers: { 'Accept': 'application/json', 'User-Agent': 'FerovaOS/1.0' } });
      if (arcticRes.ok) {
        const arcticJson = await arcticRes.json();
        const posts = mapPullPushPosts(arcticJson?.data || [], cleanSub, limit);
        return new Response(JSON.stringify({ ok: true, subreddit: cleanSub, listing, count: posts.length, posts, mode: 'arctic_shift_fallback' }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const pullpush = new URL('https://api.pullpush.io/reddit/search/submission/');
      pullpush.searchParams.set('subreddit', cleanSub);
      pullpush.searchParams.set('size', String(limit));
      pullpush.searchParams.set('sort', 'desc');
      pullpush.searchParams.set('sort_type', 'created_utc');
      const pullRes = await fetch(pullpush.toString(), { headers: { 'Accept': 'application/json' } });
      if (pullRes.ok) {
        const pullJson = await pullRes.json();
        const posts = mapPullPushPosts(pullJson?.data || [], cleanSub, limit);
        return new Response(JSON.stringify({ ok: true, subreddit: cleanSub, listing, count: posts.length, posts, mode: 'pullpush_fallback' }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const rssUrl = `https://www.reddit.com/r/${cleanSub}/${listing}/.rss?limit=${limit}`;
      const rssRes = await fetch(rssUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FerovaOS/1.0; +https://ferova.agency)', 'Accept': 'application/atom+xml,text/xml,*/*' },
      });
      if (rssRes.ok) {
        const posts = parseAtomPosts(await rssRes.text(), cleanSub, limit);
        return new Response(JSON.stringify({ ok: true, subreddit: cleanSub, listing, count: posts.length, posts, mode: 'rss_fallback' }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const body = await res.text();
      const rssBody = await rssRes.text().catch(() => '');
      console.error(`[reddit-fetch-subreddit] Reddit JSON ${res.status}, Arctic ${arcticRes.status}, PullPush ${pullRes.status}, RSS ${rssRes.status}: ${body.slice(0, 120)} ${rssBody.slice(0, 120)}`);
      return new Response(JSON.stringify({ ok: false, message: `Reddit bloqueó la consulta pública (${res.status}/${arcticRes.status}/${pullRes.status}/${rssRes.status}). Intenta otra comunidad o vuelve a probar en unos minutos.`, details: body.slice(0, 300) }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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
        subreddit: p.subreddit || cleanSub,
        num_comments: p.num_comments || 0,
        score: p.score || 0,
        upvote_ratio: p.upvote_ratio || 0,
        created_utc: p.created_utc || 0,
        url: `https://www.reddit.com${p.permalink}`,
        link_flair_text: p.link_flair_text || null,
        is_self: !!p.is_self,
      };
    });

    return new Response(JSON.stringify({ ok: true, subreddit: cleanSub, listing, count: posts.length, posts }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[reddit-fetch-subreddit] error:', err);
    return new Response(JSON.stringify({ ok: false, message: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
