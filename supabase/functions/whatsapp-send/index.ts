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

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ ok: false, message: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace("Bearer ", "");
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userErr } = await userClient.auth.getUser(jwt);
    if (userErr || !userData?.user?.email) {
      return jsonResponse({ ok: false, message: "No autenticado." }, 401);
    }
    const email = userData.user.email;

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: member } = await admin.from("crm_team_members").select("email").eq("email", email).maybeSingle();
    if (!member) return jsonResponse({ ok: false, message: "No autorizado." }, 403);

    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
      return jsonResponse({ ok: false, message: "WhatsApp necesita configurar EVOLUTION_API_URL y EVOLUTION_API_KEY antes de enviar mensajes." });
    }

    const { oportunidad_id, text } = await req.json();
    if (!oportunidad_id || !text) {
      return jsonResponse({ ok: false, message: "Falta oportunidad_id o text." }, 400);
    }

    const { data: oportunidad } = await admin.from("crm_oportunidades").select("telefono").eq("id", oportunidad_id).single();
    if (!oportunidad?.telefono) {
      return jsonResponse({ ok: false, message: "Esta oportunidad no tiene telefono de WhatsApp." }, 400);
    }

    const { data: instance } = await admin
      .from("crm_whatsapp_instances")
      .select("instance_name, status")
      .eq("user_id", userData.user.id)
      .maybeSingle();
    const instanceName = instance?.instance_name || EVOLUTION_INSTANCE_NAME;
    if (!instanceName) {
      return jsonResponse({ ok: false, message: "Primero conecta tu número en CRM > Bot WhatsApp para generar y escanear el QR." });
    }

    const to = `${oportunidad.telefono}@s.whatsapp.net`;
    const res = await fetch(`${EVOLUTION_API_URL}/message/sendText/${instanceName}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: EVOLUTION_API_KEY },
      body: JSON.stringify({ number: to, text }),
    });
    if (!res.ok) {
      return jsonResponse({ ok: false, message: `Evolution API error (${res.status}): ${await res.text()}` });
    }

    await admin.from("crm_interacciones").insert({
      oportunidad_id,
      canal: "whatsapp",
      tipo: "mensaje_saliente",
      contenido: text,
      created_by: email,
    });

    return jsonResponse({ ok: true });
  } catch (err) {
    return jsonResponse({ ok: false, message: err instanceof Error ? err.message : String(err) });
  }
});
