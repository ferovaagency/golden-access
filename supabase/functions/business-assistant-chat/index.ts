import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { convertToModelMessages, streamText, type UIMessage } from "npm:ai";
import { createLovableAiGatewayProvider, getLovableAiGatewayRunId, getLovableAiGatewayResponseHeaders, withLovableAiGatewayRunIdHeader } from "../_shared/ai-gateway.ts";

function textFromParts(message: UIMessage): string {
  return (message.parts || []).map((part: any) => part.type === "text" ? part.text : "").join("").trim();
}

function latestAssistant(messages: UIMessage[]): UIMessage | null {
  for (let index = messages.length - 1; index >= 0; index--) {
    if (messages[index].role === "assistant") return messages[index];
  }
  return null;
}

const MAX_MODEL_MESSAGES = 24;
const MAX_STORED_MESSAGES = 80;

async function trimStoredHistory(admin: ReturnType<typeof createClient>, userId: string) {
  const { data, error } = await admin
    .from('business_assistant_messages')
    .select('id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(MAX_STORED_MESSAGES, MAX_STORED_MESSAGES + 200);
  if (error || !data?.length) return;
  const { error: deleteError } = await admin
    .from('business_assistant_messages')
    .delete()
    .in('id', data.map((message: { id: string }) => message.id));
  if (deleteError) console.error('[business-assistant] history trim error', deleteError);
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
    if (userError || !userData.user) return new Response(JSON.stringify({ ok: false, message: "Sesion invalida" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const userId = userData.user.id;
    const userEmail = userData.user.email || "";
    const currentArea = (req.headers.get("X-Ferova-Context-Area") || "").slice(0, 80);
    const [{ data: isTeam }, { data: businessProfile }, { data: overview }, { data: services }, { data: growth }, { data: reviews }, { data: opportunities }, { data: clients }, { data: hours }] = await Promise.all([
      admin.from("crm_team_members").select("email").eq("email", userEmail).maybeSingle(),
      admin.from("business_profile").select("nombre_negocio, industria, tipo_negocio, tamano_equipo, ciudad").eq("user_id", userId).maybeSingle(),
      admin.from("business_overview").select("*").eq("user_id", userId).maybeSingle(),
      admin.from("finance_service_profitability").select("servicio_nombre, ingresos_brutos, costos_directos, margen_bruto, ventas_count, horas_registradas").eq("user_id", userId).order("margen_bruto", { ascending: false }).limit(12),
      admin.from("crm_growth_overview").select("*").maybeSingle(),
      admin.from("crm_resenas").select("plataforma, calificacion, resenador, respondida, detectada_en").order("detectada_en", { ascending: false }).limit(10),
      admin.from("crm_oportunidades").select("nombre_contacto, empresa, canal_origen, estado, valor_estimado, moneda, siguiente_accion, memoria_resumen, memoria_updated_at").order("updated_at", { ascending: false }).limit(15),
      admin.from("finance_clientes").select("nombre, tipo, activo, progreso, responsable, objetivos, kpis, entregables").eq("user_id", userId).order("nombre").limit(20),
      admin.from("finance_horas").select("fecha, cliente_id, servicio_id, horas, descripcion").eq("user_id", userId).order("fecha", { ascending: false }).limit(30),
    ]);

    const body = await req.json() as { messages?: UIMessage[] };
    // The client can display a short recent history, but the model receives a
    // bounded window so long conversations do not grow cost or context forever.
    const messages = (body.messages || []).slice(-MAX_MODEL_MESSAGES);
    const last = messages[messages.length - 1];
    if (last?.role === "user") {
      const { error } = await admin.from("business_assistant_messages").insert({ user_id: userId, role: "user", parts: last.parts || [], content: textFromParts(last) });
      if (error) console.error("[business-assistant] user persist error", error);
    }

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return new Response(JSON.stringify({ ok: false, message: "LOVABLE_API_KEY no configurada" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const context = JSON.stringify({
      user: { email: userEmail, team_member: !!isTeam },
      screen_context: currentArea || null,
      negocio: businessProfile || null,
      finance_overview: overview,
      service_profitability: services || [],
      crm_growth: isTeam ? growth : null,
      recent_reviews: isTeam ? reviews : [],
      recent_opportunities: isTeam ? opportunities : [],
      clients: clients || [],
      recent_hours: hours || [],
    }, null, 2);

    const initialRunId = getLovableAiGatewayRunId(req);
    const gateway = createLovableAiGatewayProvider(apiKey, initialRunId);
    const result = streamText({
      model: gateway("google/gemini-3-flash-preview"),
      system: `Sos el asesor financiero y gerencial experto de ${businessProfile?.nombre_negocio || "este negocio"} dentro de Ferova OS. Tu rol es el de un consultor de confianza: das recomendaciones concretas y accionables, no solo reportas números. Respondé en español claro, cercano y sin jerga técnica innecesaria (quien te lee puede no saber de finanzas ni de tecnología).

REGLA INQUEBRANTABLE: Usá EXCLUSIVAMENTE el contexto JSON de negocio provisto abajo y el historial del chat -- ninguna otra fuente. Si falta un dato para responder algo, decí exactamente qué falta y dónde cargarlo (ej. "no tengo tus gastos de este mes, cárgalos en Costos"); nunca inventes cifras, clientes, reseñas, servicios ni estados, y nunca des cifras de referencia genéricas del mercado como si fueran datos reales de este negocio.

Das asesoría sobre: rentabilidad por servicio, salud del flujo de caja, pipeline de ventas, reseñas pendientes, cartera de clientes, gastos vs. ingresos, y próximos pasos priorizados. Cuando algo se ve mal (ej. margen negativo, cliente inactivo con saldo pendiente), decilo directo y proponé una acción concreta, no solo el diagnóstico. No prometas acciones automáticas (no ejecutás nada, solo asesorás).

CONTEXTO ACTUAL DEL NEGOCIO:
${context}`,
      messages: await convertToModelMessages(messages),
    });

    const response = result.toUIMessageStreamResponse({
      originalMessages: messages,
      headers: getLovableAiGatewayResponseHeaders(undefined, { ...corsHeaders, ...(initialRunId ? { "X-Lovable-AIG-Run-ID": initialRunId } : {}) }),
      onFinish: async ({ messages: finishedMessages }: any) => {
        const responseMessage = latestAssistant(finishedMessages || []);
        if (!responseMessage) return;
        const { error } = await admin.from("business_assistant_messages").insert({ user_id: userId, role: "assistant", parts: responseMessage.parts || [], content: textFromParts(responseMessage) });
        if (error) console.error("[business-assistant] assistant persist error", error);
        else await trimStoredHistory(admin, userId);
      },
    });

    return withLovableAiGatewayRunIdHeader(response, gateway, corsHeaders);
  } catch (err) {
    console.error("[business-assistant] error", err);
    return new Response(JSON.stringify({ ok: false, message: err instanceof Error ? err.message : String(err) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
