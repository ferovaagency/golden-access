import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const EVOLUTION_API_URL = (Deno.env.get("EVOLUTION_API_URL") || "").trim().replace(/\/$/, "");
const EVOLUTION_API_KEY = (Deno.env.get("EVOLUTION_API_KEY") || "").trim();
const WEBHOOK_TOKEN = Deno.env.get("WHATSAPP_WEBHOOK_TOKEN") || "";

const evoHeaders = { "Content-Type": "application/json", apikey: EVOLUTION_API_KEY };

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

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
  if (req.method !== "POST") return jsonResponse({ ok: false, message: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user?.email) return jsonResponse({ ok: false, message: "No autenticado" }, 401);
    const { data: member } = await userClient.from("crm_team_members").select("email").eq("email", user.email).maybeSingle();
    if (!member) return jsonResponse({ ok: false, message: "No autorizado" }, 403);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const instanceName = instanceNameFor(user.id);

    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
      const missing = [
        !EVOLUTION_API_URL ? "EVOLUTION_API_URL" : null,
        !EVOLUTION_API_KEY ? "EVOLUTION_API_KEY" : null,
      ].filter(Boolean).join(", ");
      const message = `WhatsApp necesita configurar ${missing} para generar el QR automático.`;
      const { data: saved, error } = await admin.from("crm_whatsapp_instances").upsert({
        user_id: user.id,
        instance_name: instanceName,
        status: "setup_required",
        qr_code: null,
        pairing_code: null,
        last_error: message,
        updated_at: new Date().toISOString(),
      }).select("*").single();
      if (error) throw error;
      return jsonResponse({ ok: true, configured: false, message, instance: saved });
    }

    const create = await evo("/instance/create", {
      method: "POST",
      body: JSON.stringify({ instanceName, qrcode: true, integration: "WHATSAPP-BAILEYS" }),
    });
    if (!create.ok && ![400, 403, 409].includes(create.status)) {
      await admin.from("crm_whatsapp_instances").upsert({ user_id: user.id, instance_name: instanceName, status: "error", last_error: create.text });
      return jsonResponse({ ok: false, message: "No pude crear la instancia de WhatsApp", status: create.status, details: create.text });
    }

    // Not fatal to the QR-connect flow if this fails, but the caller must
    // know: silently swallowing this means incoming WhatsApp messages never
    // reach whatsapp-webhook and nothing about the UI would say why.
    let webhookConfigured = false;
    let webhookError: string | null = null;
    if (WEBHOOK_TOKEN) {
      const webhookUrl = `${SUPABASE_URL}/functions/v1/whatsapp-webhook?token=${encodeURIComponent(WEBHOOK_TOKEN)}`;
      const webhookRes = await evo(`/webhook/set/${instanceName}`, {
        method: "POST",
        body: JSON.stringify({ webhook: { enabled: true, url: webhookUrl, events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE"] } }),
      }).catch((err) => ({ ok: false, text: err instanceof Error ? err.message : String(err) } as any));
      webhookConfigured = !!webhookRes?.ok;
      if (!webhookConfigured) webhookError = webhookRes?.text || "No se pudo registrar el webhook.";
    }

    const connect = await evo(`/instance/connect/${instanceName}`, { method: "GET" });
    const qr = pickQr(connect.data) || pickQr(create.data);
    const pairingCode = connect.data?.pairingCode || connect.data?.pairing_code || null;
    const status = qr ? "qr_ready" : (connect.ok ? "connecting" : "error");
    const lastError = !connect.ok ? connect.text : (webhookError ? `Webhook no registrado: ${webhookError}` : null);

    const { data: saved, error } = await admin.from("crm_whatsapp_instances").upsert({
      user_id: user.id,
      instance_name: instanceName,
      status,
      qr_code: qr,
      pairing_code: pairingCode,
      last_error: lastError,
      updated_at: new Date().toISOString(),
    }).select("*").single();
    if (error) throw error;

    return jsonResponse({ ok: true, configured: true, webhook_configured: webhookConfigured, instance: saved });
  } catch (err) {
    console.error("[whatsapp-connect] error", err);
    return jsonResponse({ ok: false, message: err instanceof Error ? err.message : String(err) });
  }
});