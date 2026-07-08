import { createClient } from "jsr:@supabase/supabase-js@2";

// Analiza una publicacion de LinkedIn o Reddit PEGADA MANUALMENTE (nunca la
// scrapeamos -- LinkedIn no tiene una API publica de busqueda y automatizar
// eso viola sus terminos y arriesga la cuenta). El equipo pega el texto/link
// y esta funcion usa el AI Gateway de Lovable para puntuar el potencial y
// redactar un comentario sugerido, que el equipo publica manualmente.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";
const CHAT_MODEL = "google/gemini-2.5-flash";

const SYSTEM_PROMPT = `Eres el analista de prospeccion de Ferova Agency (SEO, GEO/AIO, e-commerce, automatizacion con IA, asesoria estrategica para founders).
Te pasan el texto de una publicacion de LinkedIn o Reddit. Tu tarea:
1. Evaluar que tan probable es que comentar esa publicacion genere interacciones, mensajes al DM/WhatsApp o solicitudes de cotizacion para Ferova (no "viralidad" generica, sino potencial real de generar una conversacion comercial).
2. Dar un score_potencial de 0 a 100.
3. Dar una razon breve (1-2 frases).
4. Redactar un comentario sugerido en español, natural, util, sin sonar a venta agresiva ni a IA, que aporte valor real a la conversacion y abra la puerta a que la persona pregunte mas (nunca pidiendo el numero directamente en el primer comentario).
Responde SOLO con un objeto JSON valido, sin texto adicional, con esta forma exacta:
{"score_potencial": number, "razon": string, "comentario_sugerido": string}`;

function extractJson(text: string): any {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("La IA no devolvió un JSON reconocible.");
  return JSON.parse(match[0]);
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response(JSON.stringify({ ok: false, message: "Method not allowed" }), { status: 405 });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace("Bearer ", "");
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userErr } = await userClient.auth.getUser(jwt);
    if (userErr || !userData?.user?.email) {
      return new Response(JSON.stringify({ ok: false, message: "No autenticado." }), { status: 401 });
    }
    const email = userData.user.email;

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: member } = await admin.from("crm_team_members").select("email").eq("email", email).maybeSingle();
    if (!member) return new Response(JSON.stringify({ ok: false, message: "No autorizado." }), { status: 403 });

    const { plataforma, url_publicacion, autor, texto } = await req.json();
    if (!plataforma || !url_publicacion || !texto) {
      return new Response(JSON.stringify({ ok: false, message: "Faltan plataforma, url_publicacion o texto." }), { status: 400 });
    }
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ ok: false, message: "LOVABLE_API_KEY no configurado en los secrets de la función." }), { status: 500 });
    }

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${LOVABLE_API_KEY}` },
      body: JSON.stringify({
        model: CHAT_MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `Plataforma: ${plataforma}\nAutor: ${autor || "desconocido"}\n\nTexto de la publicación:\n${texto}` },
        ],
      }),
    });
    if (!aiRes.ok) {
      return new Response(JSON.stringify({ ok: false, message: `Error del AI Gateway (${aiRes.status}): ${await aiRes.text()}` }), { status: 502 });
    }
    const aiData = await aiRes.json();
    const rawText = aiData?.choices?.[0]?.message?.content || "";
    const parsed = extractJson(rawText);

    const { data: created, error: insertErr } = await admin
      .from("crm_contenido_potencial")
      .insert({
        plataforma,
        url_publicacion,
        autor: autor || null,
        resumen: texto.slice(0, 500),
        score_potencial: Math.max(0, Math.min(100, Math.round(Number(parsed.score_potencial) || 0))),
        razon: parsed.razon || null,
        comentario_sugerido: parsed.comentario_sugerido || null,
        estado: "sugerido",
      })
      .select("*")
      .single();

    if (insertErr) {
      return new Response(JSON.stringify({ ok: false, message: insertErr.message }), { status: 500 });
    }

    return new Response(JSON.stringify({ ok: true, item: created }), { headers: { "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, message: err instanceof Error ? err.message : String(err) }), { status: 500 });
  }
});
