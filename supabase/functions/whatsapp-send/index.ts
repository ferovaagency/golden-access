import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

// Envio manual de WhatsApp desde el CRM (AdminCRM.tsx). Solo miembros del
// equipo Ferova (crm_team_members) pueden usarlo.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const EVOLUTION_API_URL = (Deno.env.get("EVOLUTION_API_URL") || "").trim().replace(/\/$/, "");
const EVOLUTION_API_KEY = (Deno.env.get("EVOLUTION_API_KEY") || "").trim();
const EVOLUTION_INSTANCE_NAME = (Deno.env.get("EVOLUTION_INSTANCE_NAME") || "").trim();

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

    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY || !EVOLUTION_INSTANCE_NAME) {
      return new Response(JSON.stringify({ ok: false, message: "WhatsApp no está configurado. Conecta una instancia de Evolution API y guarda EVOLUTION_API_URL, EVOLUTION_API_KEY y EVOLUTION_INSTANCE_NAME en secretos." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { oportunidad_id, text } = await req.json();
    if (!oportunidad_id || !text) {
      return new Response(JSON.stringify({ ok: false, message: "Falta oportunidad_id o text." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: oportunidad } = await admin.from("crm_oportunidades").select("telefono").eq("id", oportunidad_id).single();
    if (!oportunidad?.telefono) {
      return new Response(JSON.stringify({ ok: false, message: "Esta oportunidad no tiene telefono de WhatsApp." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const to = `${oportunidad.telefono}@s.whatsapp.net`;
    const res = await fetch(`${EVOLUTION_API_URL}/message/sendText/${EVOLUTION_INSTANCE_NAME}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: EVOLUTION_API_KEY },
      body: JSON.stringify({ number: to, text }),
    });
    if (!res.ok) {
      return new Response(JSON.stringify({ ok: false, message: `Evolution API error (${res.status}): ${await res.text()}` }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    await admin.from("crm_interacciones").insert({
      oportunidad_id,
      canal: "whatsapp",
      tipo: "mensaje_saliente",
      contenido: text,
      created_by: email,
    });

    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, message: err instanceof Error ? err.message : String(err) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
