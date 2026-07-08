import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

// Recibe eventos messages.upsert de Evolution API para la instancia de WhatsApp
// de Ferova Agency. Registra todo en el CRM (crm_oportunidades/crm_interacciones)
// y, si el bot esta activo, genera una respuesta con la IA de Lovable (Gateway,
// RAG contra crm_bot_knowledge) y la envia de vuelta por WhatsApp.
// No usa verify_jwt: Evolution no manda un JWT de Supabase, en su lugar
// validamos un token compartido en la query string (?token=...).

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WEBHOOK_TOKEN = Deno.env.get("WHATSAPP_WEBHOOK_TOKEN") || "";
const EVOLUTION_API_URL = (Deno.env.get("EVOLUTION_API_URL") || "").trim().replace(/\/$/, "");
const EVOLUTION_API_KEY = (Deno.env.get("EVOLUTION_API_KEY") || "").trim();
const EVOLUTION_INSTANCE_NAME = (Deno.env.get("EVOLUTION_INSTANCE_NAME") || "").trim();
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";

const LOVABLE_GATEWAY = "https://ai.gateway.lovable.dev/v1";
const CHAT_MODEL = "google/gemini-2.5-flash";
const EMBED_MODEL = "google/gemini-embedding-001";

const evoHeaders = { "Content-Type": "application/json", apikey: EVOLUTION_API_KEY };
const aiHeaders = { "Content-Type": "application/json", "Lovable-API-Key": LOVABLE_API_KEY, "X-Lovable-AIG-SDK": "manual-fetch" };

async function sendWhatsapp(instanceName: string, to: string, text: string) {
  if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY || !instanceName) {
    throw new Error("WhatsApp no está configurado: faltan EVOLUTION_API_URL, EVOLUTION_API_KEY o instancia.");
  }
  const res = await fetch(`${EVOLUTION_API_URL}/message/sendText/${instanceName}`, {
    method: "POST",
    headers: evoHeaders,
    body: JSON.stringify({ number: to, text }),
  });
  if (!res.ok) throw new Error(`Evolution API error ${res.status}: ${await res.text()}`);
}

function extractText(msg: any): string {
  return (
    msg?.message?.conversation ||
    msg?.message?.extendedTextMessage?.text ||
    msg?.message?.ephemeralMessage?.message?.conversation ||
    msg?.message?.ephemeralMessage?.message?.extendedTextMessage?.text ||
    msg?.message?.imageMessage?.caption ||
    ""
  );
}

function normalizeCmd(text: string): string {
  return text.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

// Genera el embedding via el AI Gateway de Lovable. Si falla o el key no esta
// configurado, retorna null y el flujo sigue sin RAG (no bloquea la respuesta).
async function embed(text: string): Promise<number[] | null> {
  if (!LOVABLE_API_KEY) return null;
  try {
    const res = await fetch(`${LOVABLE_GATEWAY}/embeddings`, {
      method: "POST",
      headers: aiHeaders,
      body: JSON.stringify({ model: EMBED_MODEL, input: text }),
    });
    if (!res.ok) {
      console.warn("[whatsapp-webhook] embed failed:", res.status, await res.text());
      return null;
    }
    const data = await res.json();
    const vec = data?.data?.[0]?.embedding ?? null;
    if (!Array.isArray(vec) || vec.length !== 768) {
      console.warn("[whatsapp-webhook] unexpected embedding shape/length:", vec?.length);
      return null;
    }
    return vec;
  } catch (err) {
    console.warn("[whatsapp-webhook] embed error:", err);
    return null;
  }
}

async function generateReply(systemPrompt: string, history: { role: string; content: string }[]): Promise<string> {
  const messages = [
    { role: "system", content: systemPrompt },
    ...history.map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content })),
  ];
  const res = await fetch(`${LOVABLE_GATEWAY}/chat/completions`, {
    method: "POST",
    headers: aiHeaders,
    body: JSON.stringify({ model: CHAT_MODEL, messages }),
  });
  if (!res.ok) throw new Error(`Lovable AI Gateway error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data?.choices?.[0]?.message?.content || "Gracias por tu mensaje, en breve te respondemos.";
}

async function updateOpportunityMemory(admin: any, oportunidad: any) {
  if (!LOVABLE_API_KEY || !oportunidad?.id) return;
  try {
    const { data: recientes } = await admin
      .from("crm_interacciones")
      .select("tipo, contenido, ocurrido_en")
      .eq("oportunidad_id", oportunidad.id)
      .order("ocurrido_en", { ascending: false })
      .limit(16);
    const transcript = (recientes || [])
      .reverse()
      .map((m: any) => `${m.tipo === "mensaje_entrante" ? "Cliente" : "Ferova"}: ${m.contenido || ""}`)
      .join("\n")
      .slice(0, 6000);
    if (!transcript.trim()) return;
    const prompt = `Resume memoria útil del prospecto para ventas en máximo 900 caracteres. Incluye: necesidad, objeciones, datos de contacto, servicio probable y próximo paso. No inventes datos.\n\nMemoria previa:\n${oportunidad.memoria_resumen || "(vacía)"}\n\nConversación reciente:\n${transcript}`;
    const res = await fetch(`${LOVABLE_GATEWAY}/chat/completions`, {
      method: "POST",
      headers: aiHeaders,
      body: JSON.stringify({
        model: CHAT_MODEL,
        messages: [
          { role: "system", content: "Eres memoria CRM. Devuelve solo el resumen actualizado, sin markdown." },
          { role: "user", content: prompt },
        ],
      }),
    });
    if (!res.ok) return;
    const data = await res.json();
    const memory = data?.choices?.[0]?.message?.content?.trim();
    if (!memory) return;
    await admin.from("crm_oportunidades").update({ memoria_resumen: memory, memoria_updated_at: new Date().toISOString() }).eq("id", oportunidad.id);
  } catch (err) {
    console.warn("[whatsapp-webhook] memory update failed:", err);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const url = new URL(req.url);
  if (url.searchParams.get("token") !== WEBHOOK_TOKEN || !WEBHOOK_TOKEN) {
    return new Response("forbidden", { status: 403, headers: corsHeaders });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const event = body.event;
  const instanceName: string = body.instance ?? "";
  let msg: any = null;
  if (Array.isArray(body.data)) msg = body.data[0] ?? null;
  else if (Array.isArray(body.data?.messages)) msg = body.data.messages[0] ?? null;
  else if (body.data?.key) msg = body.data;

  if (event === "connection.update" || event === "CONNECTION_UPDATE") {
    const status = body.data?.state || body.data?.status || body.state || "connected";
    await admin.from("crm_whatsapp_instances").update({
      status: String(status).toLowerCase().includes("open") || String(status).toLowerCase().includes("connect") ? "connected" : String(status),
      connected_at: String(status).toLowerCase().includes("open") || String(status).toLowerCase().includes("connect") ? new Date().toISOString() : null,
    }).eq("instance_name", instanceName);
    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const { data: instance } = await admin.from("crm_whatsapp_instances").select("user_id, instance_name").eq("instance_name", instanceName).maybeSingle();
  const isLegacyInstance = EVOLUTION_INSTANCE_NAME && instanceName === EVOLUTION_INSTANCE_NAME;

  if (event !== "messages.upsert" || !msg || (!instance && !isLegacyInstance)) {
    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const messageText = extractText(msg);
  const fromMe: boolean = !!msg.key?.fromMe;
  const remoteJid: string = msg.key?.remoteJid ?? "";
  const phone = remoteJid.replace("@s.whatsapp.net", "");

  // Mensajes propios (del equipo Ferova, desde la app de WhatsApp)
  if (fromMe) {
    const cmd = normalizeCmd(messageText);
    if (cmd === "activar bot" || cmd === "apagar bot") {
      const enable = cmd === "activar bot";
      await admin.from("crm_bot_config").update({ bot_enabled: enable, updated_at: new Date().toISOString() }).eq("id", true);
      await sendWhatsapp(instanceName, remoteJid, enable ? "✅ Bot activado." : "⏸️ Bot desactivado.");
    } else if (messageText && phone && !remoteJid.endsWith("@g.us")) {
      const { data: oportunidad } = await admin.from("crm_oportunidades").select("id").eq("telefono", phone).maybeSingle();
      if (oportunidad) {
        await admin.from("crm_interacciones").insert({
          oportunidad_id: oportunidad.id,
          canal: "whatsapp",
          tipo: "mensaje_saliente",
          contenido: messageText,
          whatsapp_message_id: msg.key?.id ?? null,
        });
      }
    }
    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  if (!phone || !messageText || remoteJid.endsWith("@g.us")) {
    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // Encontrar o crear la oportunidad para este numero
  let { data: oportunidad } = await admin.from("crm_oportunidades").select("*").eq("telefono", phone).maybeSingle();
  if (!oportunidad) {
    const pushName = msg.pushName || phone;
    const { data: created } = await admin
      .from("crm_oportunidades")
      .insert({
        nombre_contacto: pushName,
        telefono: phone,
        canal_origen: "whatsapp",
        estado: "nuevo",
        memoria_resumen: `Primer contacto por WhatsApp. Nombre detectado: ${pushName}. Teléfono: ${phone}.`,
        memoria_updated_at: new Date().toISOString(),
      })
      .select("*")
      .single();
    oportunidad = created;
  }
  if (!oportunidad) return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const msgId = msg.key?.id;
  await admin.from("crm_interacciones").insert({
    oportunidad_id: oportunidad.id,
    canal: "whatsapp",
    tipo: "mensaje_entrante",
    contenido: messageText,
    whatsapp_message_id: msgId ?? null,
    metadata: { instance_name: instanceName, push_name: msg.pushName || null },
  }); // el indice unico parcial descarta duplicados silenciosamente via error, lo ignoramos

  updateOpportunityMemory(admin, oportunidad).catch(() => null);

  const { data: botConfig } = await admin.from("crm_bot_config").select("*").eq("id", true).single();
  if (!botConfig?.bot_enabled) {
    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  try {
    const { data: recientes } = await admin
      .from("crm_interacciones")
      .select("tipo, contenido, ocurrido_en")
      .eq("oportunidad_id", oportunidad.id)
      .order("ocurrido_en", { ascending: false })
      .limit(10);

    const history = (recientes ?? [])
      .reverse()
      .filter((m) => m.tipo === "mensaje_entrante" || m.tipo === "mensaje_saliente")
      .map((m) => ({ role: m.tipo === "mensaje_entrante" ? "user" : "assistant", content: m.contenido || "" }));

    let knowledgeText = "";
    const vec = await embed(messageText);
    if (vec) {
      const { data: matches } = await admin.rpc("match_bot_knowledge", { query_embedding: vec, match_count: 5 });
      knowledgeText = (matches ?? []).map((m: any) => m.content).join("\n---\n");
    }

    const basePrompt = botConfig.custom_prompt || "Eres el asistente de ventas de Ferova Agency. Ayuda a los prospectos, responde preguntas y agenda diagnosticos con calidez y honestidad.";
    const systemPrompt = knowledgeText
      ? `${basePrompt}\n\nUsa unicamente la siguiente informacion del negocio para responder, no inventes datos:\n${knowledgeText}\n\nResponde en el mismo idioma del cliente, se conciso (maximo 3 parrafos cortos).`
      : `${basePrompt}\n\nResponde en el mismo idioma del cliente, se conciso (maximo 3 parrafos cortos).`;

    const reply = await generateReply(systemPrompt, history);
    await sendWhatsapp(instanceName, remoteJid, reply);
    await admin.from("crm_interacciones").insert({
      oportunidad_id: oportunidad.id,
      canal: "whatsapp",
      tipo: "mensaje_saliente",
      contenido: reply,
    });
    updateOpportunityMemory(admin, oportunidad).catch(() => null);
  } catch (err) {
    console.error("[whatsapp-webhook] reply error:", err);
  }

  return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
