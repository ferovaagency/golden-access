// Analiza una publicación de LinkedIn (o Reddit) pegada manualmente:
// - Recibe URL, texto y (opcional) autor/plataforma.
// - Usa Lovable AI Gateway (Google Gemini) para dar score 0-100, razón y comentario sugerido.
// - Guarda el resultado en crm_contenido_potencial.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod';

// url_publicacion se deja como string libre (no .url() estricto): es un campo
// pegado a mano y no vale la pena rechazar un link sin "https://" cuando el resto
// del flujo lo tolera igual.
const BodySchema = z.object({
  plataforma: z.enum(['linkedin', 'reddit']).optional(),
  url_publicacion: z.string().trim().min(3).max(500),
  autor: z.string().trim().max(200).nullable().optional(),
  texto: z.string().trim().min(30, 'texto debe tener al menos 30 caracteres').max(20000),
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

    const parsedBody = BodySchema.safeParse(await req.json());
    if (!parsedBody.success) {
      return new Response(JSON.stringify({ ok: false, message: 'Parámetros inválidos', errors: parsedBody.error.flatten().fieldErrors }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const body = parsedBody.data;
    const plataforma = body.plataforma || (body.url_publicacion.includes('reddit.com') ? 'reddit' : 'linkedin');

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ ok: false, message: 'LOVABLE_API_KEY no configurado' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Aprendizaje por resultados: no requiere ninguna tabla/columna nueva, se calcula
    // en caliente sobre crm_oportunidades ya existente (estado ganado/perdido por canal).
    // Se usa como contexto para que el score se ajuste con la experiencia real del negocio,
    // no solo con el criterio genérico de la IA.
    let winRateContext = 'Sin historial de oportunidades cerradas todavía (usa solo tu criterio).';
    try {
      const { data: closedRows } = await supabase
        .from('crm_oportunidades')
        .select('canal_origen, estado')
        .in('estado', ['ganado', 'perdido']);
      const statsByCanal: Record<string, { won: number; lost: number }> = {};
      for (const row of closedRows || []) {
        const c = (row as any).canal_origen || 'otro';
        if (!statsByCanal[c]) statsByCanal[c] = { won: 0, lost: 0 };
        if ((row as any).estado === 'ganado') statsByCanal[c].won++; else statsByCanal[c].lost++;
      }
      const lines = Object.entries(statsByCanal).map(([canal, s]) => {
        const total = s.won + s.lost;
        const pct = total > 0 ? Math.round((s.won / total) * 100) : null;
        return `- ${canal}: ${pct !== null ? `${pct}% de conversión histórica` : 'sin datos suficientes'} (${s.won} ganados / ${s.lost} perdidos, de un total de ${total} oportunidades cerradas)`;
      });
      if (lines.length) winRateContext = lines.join('\n');
    } catch (err) {
      console.warn('[linkedin-analyze] no se pudo calcular win-rate histórico:', err);
    }

    const systemPrompt = `Eres un analista de prospección B2B para Ferova Agency (agencia de marketing digital, SEO/GEO, desarrollo web y automatización con IA en Colombia). Analiza publicaciones de ${plataforma} para detectar oportunidades comerciales.

IMPORTANTE: no busques solo publicaciones que pidan explícitamente un servicio ("busco quien me haga..."). También detecta cuando alguien describe un PROBLEMA o dolor que los servicios de Ferova resuelven, aunque no lo pida directamente (ej. "pierdo horas metiendo pedidos a mano", "mi tienda nunca aparece en Google", "no doy abasto respondiendo mensajes de clientes", "mi web se ve anticuada"). Ese tipo de publicación suele ser una oportunidad tan buena o mejor que una solicitud explícita, porque hay menos competencia respondiéndola.

CONTEXTO DE CONVERSIÓN HISTÓRICA POR CANAL (ajusta el score con esto, no lo ignores):
${winRateContext}

Devuelves EXCLUSIVAMENTE un JSON con estas claves:
- "score_potencial": entero 0-100 (qué tan buena oportunidad comercial es para Ferova, ya ajustado por la conversión histórica del canal si hay datos suficientes).
- "resumen": 1-2 frases explicando de qué habla la publicación.
- "razon": 1 frase justificando el score (dolor detectado -explícito o implícito-, señal de compra, autoridad del autor, y si el ajuste histórico del canal subió o bajó el score).
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
        'Lovable-API-Key': LOVABLE_API_KEY,
        'X-Lovable-AIG-SDK': 'manual-fetch',
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
