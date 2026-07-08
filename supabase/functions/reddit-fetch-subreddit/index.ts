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
      headers: { 'User-Agent': 'FerovaOS-CRM/1.0 (by u/ferova)' },
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`[reddit-fetch-subreddit] Reddit ${res.status}: ${body.slice(0, 200)}`);
      return new Response(JSON.stringify({ ok: false, message: `Reddit devolvió ${res.status}. Verifica el nombre del subreddit.`, details: body.slice(0, 300) }), {
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
