import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const EVOLUTION_API_URL = (Deno.env.get("EVOLUTION_API_URL") || "").trim().replace(/\/$/, "");
const EVOLUTION_API_KEY = (Deno.env.get("EVOLUTION_API_KEY") || "").trim();
const WEBHOOK_TOKEN = Deno.env.get("WHATSAPP_WEBHOOK_TOKEN") || "";

const evoHeaders = { "Content-Type": "application/json", apikey: EVOLUTION_API_KEY };

function instanceNameFor(userId: string) {
  return `ferova_${userId.replace(/-/g, "").slice(0, 24)}`;
}

function pickQr(data: any): string | null {
  return data?.base64 || data?.qrcode?.base64 || data?.qrcode?.code || data?.code || data?.qr || null;
}

async function evo(path: string, init?: RequestInit) {
  const res = await fetch(`${EVOLUTION_API_URL}${path}`, { ...init, headers: { ...evoHeaders, ...(init?.headers || {}) } });
  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }
  return { ok: res.ok, status: res.status, data, text };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response(JSON.stringify({ ok: false, message: "Method not allowed" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user?.email) return new Response(JSON.stringify({ ok: false, message: "No autenticado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const { data: member } = await userClient.from("crm_team_members").select("email").eq("email", user.email).maybeSingle();
    if (!member) return new Response(JSON.stringify({ ok: false, message: "No autorizado" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY || !WEBHOOK_TOKEN) {
      return new Response(JSON.stringify({ ok: false, message: "WhatsApp todavía no está configurado para emitir QR automático. Faltan EVOLUTION_API_URL, EVOLUTION_API_KEY o WHATSAPP_WEBHOOK_TOKEN." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const instanceName = instanceNameFor(user.id);

    const create = await evo("/instance/create", {
      method: "POST",
      body: JSON.stringify({ instanceName, qrcode: true, integration: "WHATSAPP-BAILEYS" }),
    });
    if (!create.ok && ![400, 403, 409].includes(create.status)) {
      await admin.from("crm_whatsapp_instances").upsert({ user_id: user.id, instance_name: instanceName, status: "error", last_error: create.text });
      return new Response(JSON.stringify({ ok: false, message: "No pude crear la instancia de WhatsApp", status: create.status, details: create.text }), { status: create.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const webhookUrl = `${SUPABASE_URL}/functions/v1/whatsapp-webhook?token=${encodeURIComponent(WEBHOOK_TOKEN)}`;
    await evo(`/webhook/set/${instanceName}`, {
      method: "POST",
      body: JSON.stringify({ webhook: { enabled: true, url: webhookUrl, events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE"] } }),
    }).catch(() => null);

    const connect = await evo(`/instance/connect/${instanceName}`, { method: "GET" });
    const qr = pickQr(connect.data) || pickQr(create.data);
    const pairingCode = connect.data?.pairingCode || connect.data?.pairing_code || null;
    const status = qr ? "qr_ready" : (connect.ok ? "connecting" : "error");

    const { data: saved, error } = await admin.from("crm_whatsapp_instances").upsert({
      user_id: user.id,
      instance_name: instanceName,
      status,
      qr_code: qr,
      pairing_code: pairingCode,
      last_error: connect.ok ? null : connect.text,
      updated_at: new Date().toISOString(),
    }).select("*").single();
    if (error) throw error;

    return new Response(JSON.stringify({ ok: true, instance: saved }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("[whatsapp-connect] error", err);
    return new Response(JSON.stringify({ ok: false, message: err instanceof Error ? err.message : String(err) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});