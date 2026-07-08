import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

// Agrega un fragmento de conocimiento (con su embedding, via el AI Gateway de
// Lovable) para entrenar al bot de WhatsApp. Solo miembros del equipo Ferova.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";
const EMBED_MODEL = "google/gemini-embedding-001";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response(JSON.stringify({ ok: false, message: "Method not allowed" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace("Bearer ", "");
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userErr } = await userClient.auth.getUser(jwt);
    if (userErr || !userData?.user?.email) {
      return new Response(JSON.stringify({ ok: false, message: "No autenticado." }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const email = userData.user.email;

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: member } = await admin.from("crm_team_members").select("email").eq("email", email).maybeSingle();
    if (!member) return new Response(JSON.stringify({ ok: false, message: "No autorizado." }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { content, source } = await req.json();
    if (!content || typeof content !== "string") {
      return new Response(JSON.stringify({ ok: false, message: "Falta content." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ ok: false, message: "LOVABLE_API_KEY no configurado en los secrets de la funcion." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const embedRes = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": LOVABLE_API_KEY, "X-Lovable-AIG-SDK": "manual-fetch" },
      body: JSON.stringify({ model: EMBED_MODEL, input: content }),
    });
    if (!embedRes.ok) {
      return new Response(JSON.stringify({ ok: false, message: `Error generando embedding (${embedRes.status}): ${await embedRes.text()}` }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const embedData = await embedRes.json();
    const embedding = embedData?.data?.[0]?.embedding;
    if (!Array.isArray(embedding) || embedding.length !== 768) {
      return new Response(
        JSON.stringify({
          ok: false,
          message: `El embedding devuelto tiene ${Array.isArray(embedding) ? embedding.length : "forma desconocida"} dimensiones, se esperaban 768. Ajusta el modelo o la columna crm_bot_knowledge.embedding.`,
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { error: insertErr } = await admin.from("crm_bot_knowledge").insert({ content, source: source || null, embedding });
    if (insertErr) {
      return new Response(JSON.stringify({ ok: false, message: insertErr.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, message: err instanceof Error ? err.message : String(err) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
