// Analiza una publicación de LinkedIn (o Reddit) pegada manualmente:
// - Recibe URL, texto y (opcional) autor/plataforma.
// - Usa Lovable AI Gateway (Google Gemini) para dar score 0-100, razón y comentario sugerido.
// - Guarda el resultado en crm_contenido_potencial.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

interface Body {
  plataforma?: 'linkedin' | 'reddit';
  url_publicacion: string;
  autor?: string | null;
  texto: string;
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
    if (!body?.url_publicacion || !body?.texto || body.texto.length < 30) {
      return new Response(JSON.stringify({ ok: false, message: 'url_publicacion y texto (≥30 chars) son requeridos' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const plataforma = body.plataforma || (body.url_publicacion.includes('reddit.com') ? 'reddit' : 'linkedin');

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ ok: false, message: 'LOVABLE_API_KEY no configurado' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const systemPrompt = `Eres un analista de prospección B2B para Ferova Agency (agencia de marketing digital, SEO/GEO, desarrollo web y automatización con IA en Colombia). Analiza publicaciones de ${plataforma} para detectar oportunidades comerciales.

Devuelves EXCLUSIVAMENTE un JSON con estas claves:
- "score_potencial": entero 0-100 (qué tan buena oportunidad comercial es para Ferova).
- "resumen": 1-2 frases explicando de qué habla la publicación.
- "razon": 1 frase justificando el score (dolor detectado, señal de compra, autoridad del autor).
- "comentario_sugerido": comentario breve (máx 400 caracteres), en español neutro, útil, sin ser vendedor. Aporta valor primero, menciona a Ferova solo si es natural. Nada de emojis excesivos. Nada de "excelente publicación".`;

    const userPrompt = `URL: ${body.url_publicacion}
Autor: ${body.autor || 'desconocido'}
Plataforma: ${plataforma}

Publicación:
"""
${body.texto.slice(0, 6000)}
"""`;

    const aiRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error(`[linkedin-analyze] AI gateway error [${aiRes.status}]: ${errText}`);
      return new Response(
        JSON.stringify({ ok: false, message: 'Error analizando con IA', status: aiRes.status, details: errText }),
        { status: aiRes.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    const aiJson = await aiRes.json();
    const content = aiJson?.choices?.[0]?.message?.content;
    if (!content) {
      return new Response(JSON.stringify({ ok: false, message: 'IA no devolvió contenido' }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch {
      return new Response(JSON.stringify({ ok: false, message: 'IA devolvió JSON inválido', raw: content }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: inserted, error: insErr } = await supabase
      .from('crm_contenido_potencial')
      .insert({
        plataforma,
        url_publicacion: body.url_publicacion,
        autor: body.autor || null,
        resumen: parsed.resumen || null,
        score_potencial: Number.isFinite(parsed.score_potencial) ? Math.round(parsed.score_potencial) : null,
        razon: parsed.razon || null,
        comentario_sugerido: parsed.comentario_sugerido || null,
        estado: 'sugerido',
      })
      .select('*')
      .single();

    if (insErr) {
      console.error('[linkedin-analyze] insert error:', insErr);
      return new Response(JSON.stringify({ ok: false, message: insErr.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ ok: true, contenido: inserted }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[linkedin-analyze] error:', err);
    return new Response(JSON.stringify({ ok: false, message: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
