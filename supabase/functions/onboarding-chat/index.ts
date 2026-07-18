import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { convertToModelMessages, streamText, type UIMessage } from "npm:ai";
import { createLovableAiGatewayProvider, getLovableAiGatewayRunId, getLovableAiGatewayResponseHeaders, withLovableAiGatewayRunIdHeader } from "../_shared/ai-gateway.ts";

// Chat guiado de bienvenida: le hace UNA pregunta a la vez al dueño del
// negocio (sin conocimientos técnicos) para llenar business_profile. Es
// deliberadamente distinto de business-assistant-chat (ese es el asesor de
// uso continuo) -- este solo existe hasta que onboarding_completado = true.

const REQUIRED_FIELDS = ["nombre_negocio", "industria", "tipo_negocio", "tamano_equipo"] as const;
const OPTIONAL_FIELDS = ["ciudad", "telefono_contacto"] as const;
type ProfilePatch = Partial<Record<typeof REQUIRED_FIELDS[number] | typeof OPTIONAL_FIELDS[number], string | null>>;

function textFromParts(message: UIMessage): string {
  return (message.parts || []).map((part: any) => part.type === "text" ? part.text : "").join("").trim();
}

function latestAssistant(messages: UIMessage[]): UIMessage | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "assistant") return messages[i];
  }
  return null;
}

function missingFieldsLabel(profile: Record<string, any> | null): string {
  const labels: Record<string, string> = {
    nombre_negocio: "nombre del negocio",
    industria: "industria/sector",
    tipo_negocio: "tipo de negocio (servicios, comercio, manufactura, etc.)",
    tamano_equipo: "tamaño del equipo (cuántas personas trabajan ahí)",
    ciudad: "ciudad",
    telefono_contacto: "teléfono de contacto",
  };
  const missing = [...REQUIRED_FIELDS, ...OPTIONAL_FIELDS].filter((f) => !profile?.[f]);
  if (missing.length === 0) return "Ninguno -- ya está todo. Cierra con un mensaje breve de bienvenida.";
  return missing.map((f) => labels[f]).join(", ");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response(JSON.stringify({ ok: false, message: "Method not allowed" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) return new Response(JSON.stringify({ ok: false, message: "No autenticado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userError } = await userClient.auth.getUser(token);
    if (userError || !userData.user) return new Response(JSON.stringify({ ok: false, message: "Sesión inválida" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const userId = userData.user.id;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return new Response(JSON.stringify({ ok: false, message: "LOVABLE_API_KEY no configurada" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const body = await req.json() as { messages?: UIMessage[] };
    const messages = body.messages || [];
    const last = messages[messages.length - 1];
    if (last?.role === "user") {
      const { error } = await admin.from("onboarding_messages").insert({ user_id: userId, role: "user", parts: last.parts || [], content: textFromParts(last) });
      if (error) console.error("[onboarding-chat] user persist error", error);
    }

    const { data: existingProfile } = await admin.from("business_profile").select("*").eq("user_id", userId).maybeSingle();

    // Extraccion estructurada: a partir de TODA la conversacion hasta ahora,
    // intenta rellenar los campos que aun falten. Nunca sobreescribe un campo
    // que ya tiene un valor (evita que una respuesta ambigua pise un dato bueno).
    if (last?.role === "user") {
      try {
        const transcript = messages.map((m) => `${m.role === "user" ? "Dueño del negocio" : "Asistente"}: ${textFromParts(m)}`).join("\n");
        const extractRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Lovable-API-Key": LOVABLE_API_KEY, "X-Lovable-AIG-SDK": "manual-fetch" },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              {
                role: "system",
                content: `Extraes datos de perfil de negocio de una conversación en español. Devuelves EXCLUSIVAMENTE un JSON con estas claves (usa null si el dato no se mencionó todavía o no es claro, nunca inventes): "nombre_negocio", "industria", "tipo_negocio", "tamano_equipo", "ciudad", "telefono_contacto". Todos son strings cortos o null.`,
              },
              { role: "user", content: transcript.slice(0, 8000) },
            ],
            response_format: { type: "json_object" },
          }),
        });
        if (extractRes.ok) {
          const extractJson = await extractRes.json();
          const raw = extractJson?.choices?.[0]?.message?.content;
          const parsed = raw ? JSON.parse(raw) : {};
          const patch: ProfilePatch = {};
          for (const field of [...REQUIRED_FIELDS, ...OPTIONAL_FIELDS]) {
            const existingValue = (existingProfile as any)?.[field];
            const extractedValue = typeof parsed[field] === "string" ? parsed[field].trim() : null;
            if (!existingValue && extractedValue) patch[field] = extractedValue;
          }
          if (Object.keys(patch).length > 0 || !existingProfile) {
            const merged = { ...(existingProfile || {}), ...patch };
            const completado = REQUIRED_FIELDS.every((f) => !!merged[f]);
            await admin.from("business_profile").upsert({
              user_id: userId,
              ...patch,
              onboarding_completado: completado,
              updated_at: new Date().toISOString(),
            });
          }
        } else {
          console.warn("[onboarding-chat] extraccion fallo:", extractRes.status, await extractRes.text());
        }
      } catch (err) {
        console.warn("[onboarding-chat] extraccion error:", err);
      }
    }

    const { data: profileAfterExtract } = await admin.from("business_profile").select("*").eq("user_id", userId).maybeSingle();

    const initialRunId = getLovableAiGatewayRunId(req);
    const gateway = createLovableAiGatewayProvider(LOVABLE_API_KEY, initialRunId);
    const result = streamText({
      model: gateway("google/gemini-2.5-flash"),
      system: `Sos un asistente de bienvenida de Ferova OS, hablás con el dueño de un negocio pequeño que probablemente NO sabe de tecnología. Tu único trabajo es ayudarlo a completar los datos básicos de su negocio, UNA pregunta a la vez, en español simple y cercano (nunca uses jerga técnica). No respondas nada de finanzas, ventas ni otro tema -- si preguntan otra cosa, decí amablemente que para eso está el "Asistente Ferova" una vez termine este paso.

Campos que todavía faltan por preguntar: ${missingFieldsLabel(profileAfterExtract)}.

Si no falta nada, felicitalo brevemente y decile que ya puede entrar a su panel. Si falta algo, hacé SOLO la siguiente pregunta pendiente (no las hagas todas juntas), de forma breve y amigable.`,
      messages: await convertToModelMessages(messages),
    });

    const response = result.toUIMessageStreamResponse({
      originalMessages: messages,
      headers: getLovableAiGatewayResponseHeaders(undefined, { ...corsHeaders, ...(initialRunId ? { "X-Lovable-AIG-Run-ID": initialRunId } : {}) }),
      onFinish: async ({ messages: finishedMessages }: any) => {
        const responseMessage = latestAssistant(finishedMessages || []);
        if (!responseMessage) return;
        const { error } = await admin.from("onboarding_messages").insert({ user_id: userId, role: "assistant", parts: responseMessage.parts || [], content: textFromParts(responseMessage) });
        if (error) console.error("[onboarding-chat] assistant persist error", error);
      },
    });

    return withLovableAiGatewayRunIdHeader(response, gateway, corsHeaders);
  } catch (err) {
    console.error("[onboarding-chat] error", err);
    return new Response(JSON.stringify({ ok: false, message: err instanceof Error ? err.message : String(err) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
