import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { convertToModelMessages, streamText, type UIMessage } from "npm:ai";
import { createLovableAiGatewayProvider, getLovableAiGatewayRunId, getLovableAiGatewayResponseHeaders, withLovableAiGatewayRunIdHeader } from "../_shared/ai-gateway.ts";

function textFromParts(message: UIMessage): string {
  return (message.parts || []).map((part: any) => part.type === "text" ? part.text : "").join("").trim();
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
    const userEmail = userData.user.email || "";
    const [{ data: isTeam }, { data: overview }, { data: services }, { data: growth }, { data: reviews }, { data: opportunities }, { data: clients }] = await Promise.all([
      admin.from("crm_team_members").select("email").eq("email", userEmail).maybeSingle(),
      admin.from("business_overview").select("*").eq("user_id", userId).maybeSingle(),
      admin.from("finance_service_profitability").select("servicio_nombre, ingresos_brutos, costos_directos, margen_bruto, ventas_count, horas_registradas").eq("user_id", userId).order("margen_bruto", { ascending: false }).limit(12),
      admin.from("crm_growth_overview").select("*").maybeSingle(),
      admin.from("crm_resenas").select("plataforma, calificacion, resenador, respondida, detectada_en").order("detectada_en", { ascending: false }).limit(10),
      admin.from("crm_oportunidades").select("nombre_contacto, empresa, canal_origen, estado, valor_estimado, moneda, siguiente_accion").order("updated_at", { ascending: false }).limit(15),
      admin.from("finance_clientes").select("nombre, tipo, activo, progreso, responsable").eq("user_id", userId).order("nombre").limit(20),
    ]);

    const body = await req.json() as { messages?: UIMessage[] };
    const messages = body.messages || [];
    const last = messages[messages.length - 1];
    if (last?.role === "user") {
      const { error } = await admin.from("business_assistant_messages").insert({ user_id: userId, role: "user", parts: last.parts || [], content: textFromParts(last) });
      if (error) console.error("[business-assistant] user persist error", error);
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return new Response(JSON.stringify({ ok: false, message: "LOVABLE_API_KEY no configurada" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const context = JSON.stringify({
      user: { email: userEmail, team_member: !!isTeam },
      finance_overview: overview,
      service_profitability: services || [],
      crm_growth: isTeam ? growth : null,
      recent_reviews: isTeam ? reviews : [],
      recent_opportunities: isTeam ? opportunities : [],
      clients: clients || [],
    }, null, 2);

    const initialRunId = getLovableAiGatewayRunId(req);
    const gateway = createLovableAiGatewayProvider(LOVABLE_API_KEY, initialRunId);
    const result = streamText({
      model: gateway("google/gemini-3-flash-preview"),
      system: `Sos el asistente interno de Ferova OS. Respondé en español claro y útil. Usá únicamente el contexto JSON de negocio provisto abajo y el historial del chat. Si falta un dato, decí exactamente qué falta y sugerí dónde cargarlo; no inventes cifras, clientes, reseñas, servicios ni estados. Ayudás a responder preguntas como servicio más rentable, estado del pipeline, reseñas pendientes, clientes, ventas, egresos y próximos pasos. No navegues fuera del tema ni prometas acciones automáticas.\n\nCONTEXTO ACTUAL DEL NEGOCIO:\n${context}`,
      messages: await convertToModelMessages(messages),
    });

    const response = result.toUIMessageStreamResponse({
      originalMessages: messages,
      headers: getLovableAiGatewayResponseHeaders(undefined, { ...corsHeaders, ...(initialRunId ? { "X-Lovable-AIG-Run-ID": initialRunId } : {}) }),
      onFinish: async ({ responseMessage }: any) => {
        const { error } = await admin.from("business_assistant_messages").insert({ user_id: userId, role: "assistant", parts: responseMessage.parts || [], content: textFromParts(responseMessage) });
        if (error) console.error("[business-assistant] assistant persist error", error);
      },
    });

    return withLovableAiGatewayRunIdHeader(response, gateway, corsHeaders);
  } catch (err) {
    console.error("[business-assistant] error", err);
    return new Response(JSON.stringify({ ok: false, message: err instanceof Error ? err.message : String(err) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});