import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { convertToModelMessages, createUIMessageStream, createUIMessageStreamResponse, jsonSchema, stepCountIs, streamText, tool, type UIMessage } from "npm:ai";
import { createLovableAiGatewayProvider, getLovableAiGatewayRunId, getLovableAiGatewayResponseHeaders, withLovableAiGatewayRunIdHeader } from "../_shared/ai-gateway.ts";
import { embedText, recallKnowledge, rememberKnowledge } from "../_shared/brain.ts";
import { logAiUsage } from "../_shared/ai-usage.ts";

function textFromParts(message: UIMessage): string {
  return (message.parts || []).map((part: any) => part.type === "text" ? part.text : "").join("").trim();
}

function latestAssistant(messages: UIMessage[]): UIMessage | null {
  for (let index = messages.length - 1; index >= 0; index--) {
    if (messages[index].role === "assistant") return messages[index];
  }
  return null;
}

// The AI SDK transport sends this streaming-protocol header. Supabase's
// default CORS headers do not include it, so browsers stop after OPTIONS and
// report the unhelpful "Failed to fetch" before the function receives POST.
const assistantCorsHeaders = {
  ...corsHeaders,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-vercel-ai-ui-message-stream, x-lovable-aig-run-id, x-ferova-context-area, x-ferova-metrics",
};

const MAX_MODEL_MESSAGES = 24;
const MAX_STORED_MESSAGES = 80;

function money(value: unknown) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(value || 0));
}

// Convierte una hora de pared local (YYYY-MM-DDTHH:mm:ss) en la zona dada a un
// instante UTC ISO. Misma lógica que el front (plannerService), para que los
// bloques que crea el asistente caigan a la hora correcta del usuario.
function wallClockToUtcIso(local: string, timeZone: string): string {
  const [datePart, timePart = "00:00:00"] = local.split("T");
  const [y, m, d] = datePart.split("-").map(Number);
  const [hh, mm, ss = 0] = timePart.split(":").map(Number);
  const asUtc = Date.UTC(y, m - 1, d, hh, mm, ss);
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
    .formatToParts(new Date(asUtc))
    .reduce<Record<string, string>>((acc, part) => { acc[part.type] = part.value; return acc; }, {});
  let hour = Number(parts.hour);
  if (hour === 24) hour = 0; // algunos entornos devuelven '24' para medianoche
  const asTz = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), hour, Number(parts.minute), Number(parts.second));
  return new Date(asUtc - (asTz - asUtc)).toISOString();
}

function deterministicReply(input: {
  question: string;
  overview: any;
  services: any[];
  opportunities: any[];
  tasks: any[];
  integrations: any;
}) {
  const question = input.question.toLowerCase();
  const overview = input.overview || {};
  const openTasks = input.tasks.filter((task) => task.status !== 'done');
  const urgentTasks = openTasks.filter((task) => task.priority === 'urgent' || task.priority === 'high');
  const negativeServices = input.services.filter((service) => Number(service.margen_bruto || 0) < 0);
  const openOpportunities = input.opportunities.filter((opportunity) => !['ganado', 'perdido'].includes(opportunity.estado));
  const missingFollowUp = openOpportunities.filter((opportunity) => !opportunity.siguiente_accion);
  const actions: string[] = [];
  const facts: string[] = [];

  let opener = '';
  if (/ingreso|margen|caja|finan|gasto|pago/.test(question)) {
    opener = 'Vamos a lo financiero.';
    facts.push(`Llevas ${money(overview.ventas_totales)} en ventas registradas y ${money(overview.egresos_pagados)} en egresos pagados.`);
    actions.push(negativeServices.length ? `Le daría una mirada a ${negativeServices.length} servicio(s) que están con margen negativo — los encuentras en Finanzas → Por servicio.` : 'Antes de comprometer nuevos pagos, compara ventas, gastos y cartera del mes en Finanzas operativas.');
  } else if (/venta|crm|prospect|cliente|oportunidad|pipeline/.test(question)) {
    opener = 'Mirando tu pipeline:';
    facts.push(`Tienes ${money(overview.pipeline_estimado)} en juego, repartidos en ${openOpportunities.length} oportunidades abiertas.`);
    actions.push(missingFollowUp.length ? `${missingFollowUp.length} oportunidad(es) no tienen un siguiente paso definido — vale la pena cerrarles eso primero.` : 'Elige hoy las oportunidades de mayor valor y agenda su próximo contacto.');
  } else if (/tarea|planner|agenda|prioridad|hoy|semana/.test(question)) {
    opener = 'Sobre tu día a día:';
    facts.push(`Tienes ${openTasks.length} tarea(s) abiertas, y ${urgentTasks.length} de esas son de prioridad alta o urgente.`);
    actions.push(urgentTasks.length ? `Yo empezaría bloqueando tiempo en el Planner para “${urgentTasks[0].title}”.` : 'Abre el Planner y elige una tarea de impacto real para tu primer bloque de foco.');
  } else {
    opener = 'Así te veo hoy:';
    facts.push(`Ventas: ${money(overview.ventas_totales)}. Pipeline: ${money(overview.pipeline_estimado)}. Tareas abiertas: ${openTasks.length}.`);
    if (missingFollowUp.length) actions.push(`Cierra el seguimiento de ${missingFollowUp.length} oportunidad(es) que se quedaron sin siguiente paso.`);
    if (urgentTasks.length) actions.push(`Protege un bloque de tiempo para “${urgentTasks[0].title}”.`);
    if (!actions.length) actions.push('Dale una pasada a Blind Spots y elige una sola cosa como prioridad de hoy.');
  }

  if (!input.integrations?.connected) actions.push('Cuando puedas, conecta Google Workspace en Configuración — así se sincronizan Calendar y Sheets automáticamente.');
  const actionIntro = actions.length > 1 ? 'Yo por ahora me enfocaría en esto:' : 'Yo por ahora haría esto:';
  return `${opener} ${facts.join(' ')}\n\n${actionIntro}\n${actions.slice(0, 3).map((action, index) => `${index + 1}. ${action}`).join('\n')}`;
}

async function trimStoredHistory(admin: SupabaseClient<any, "public", "public", any, any>, userId: string) {
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
  if (req.method === "OPTIONS") return new Response("ok", { headers: assistantCorsHeaders });
  if (req.method !== "POST") return new Response(JSON.stringify({ ok: false, message: "Method not allowed" }), { status: 405, headers: { ...assistantCorsHeaders, "Content-Type": "application/json" } });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) return new Response(JSON.stringify({ ok: false, message: "No autenticado" }), { status: 401, headers: { ...assistantCorsHeaders, "Content-Type": "application/json" } });

    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userError } = await userClient.auth.getUser(token);
    if (userError || !userData.user) return new Response(JSON.stringify({ ok: false, message: "Sesion invalida" }), { status: 401, headers: { ...assistantCorsHeaders, "Content-Type": "application/json" } });

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const userId = userData.user.id;
    const userEmail = userData.user.email || "";
    const currentArea = (req.headers.get("X-Ferova-Context-Area") || "").slice(0, 80);
    // El frontend envía las MISMAS métricas ya calculadas del dashboard (estado
    // de resultados del período), para que el asesor no dependa de una tabla
    // incompleta. Son la fuente autoritativa de utilidad/margen/equilibrio.
    let finanzasCalculadas: unknown = null;
    try { const mh = req.headers.get("X-Ferova-Metrics"); if (mh) finanzasCalculadas = JSON.parse(mh); } catch { /* header inválido, se ignora */ }
    const [{ data: isTeam }, { data: businessProfile }, { data: overview }, { data: services }, { data: growth }, { data: reviews }, { data: opportunities }, { data: clients }, { data: hours }, { data: tasks }, { data: integrations }] = await Promise.all([
      admin.from("crm_team_members").select("email, rol").eq("email", userEmail).maybeSingle(),
      admin.from("business_profile").select("nombre_negocio, industria, tipo_negocio, tamano_equipo, ciudad, zona_horaria").eq("user_id", userId).maybeSingle(),
      admin.from("business_overview").select("*").eq("user_id", userId).maybeSingle(),
      admin.from("finance_service_profitability").select("servicio_nombre, ingresos_brutos, costos_directos, margen_bruto, ventas_count, horas_registradas").eq("user_id", userId).order("margen_bruto", { ascending: false }).limit(12),
      admin.from("crm_growth_overview").select("*").maybeSingle(),
      admin.from("crm_resenas").select("plataforma, calificacion, resenador, respondida, detectada_en").eq("confirmada", true).order("detectada_en", { ascending: false }).limit(10),
      admin.from("crm_oportunidades").select("nombre_contacto, empresa, canal_origen, estado, valor_estimado, moneda, siguiente_accion, memoria_resumen, memoria_updated_at").order("updated_at", { ascending: false }).limit(15),
      admin.from("finance_clientes").select("nombre, tipo, activo, progreso, responsable, objetivos, kpis, entregables").eq("user_id", userId).order("nombre").limit(20),
      admin.from("finance_horas").select("fecha, cliente_id, servicio_id, horas, descripcion").eq("user_id", userId).order("fecha", { ascending: false }).limit(30),
      admin.from("planner_tasks").select("title, priority, category, status, deadline, scheduled_for, client_ref, project_ref").eq("user_id", userId).in("status", ["backlog", "scheduled", "postponed"]).order("deadline", { ascending: true, nullsFirst: false }).limit(30),
      admin.from("google_workspace_connections").select("connected, connected_email, scopes, expires_at, last_error").eq("user_id", userId).maybeSingle(),
    ]);

    const isAdmin = !!isTeam && ["owner", "admin"].includes((isTeam as { rol?: string }).rol || "");
    const memoriaScopeNote = isAdmin
      ? "Podés guardar en memoria 'global' (equipo) o 'privado' (solo esta persona)."
      : "IMPORTANTE: esta persona es colaboradora — SOLO podés guardar en su memoria PRIVADA (alcance 'privado'); nunca en la global.";

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
    if (!apiKey) {
      const reply = deterministicReply({ question: last ? textFromParts(last) : '', overview, services: services || [], opportunities: opportunities || [], tasks: tasks || [], integrations });
      const textId = crypto.randomUUID();
      const stream = createUIMessageStream({
        originalMessages: messages,
        execute: ({ writer }) => {
          writer.write({ type: 'text-start', id: textId });
          writer.write({ type: 'text-delta', id: textId, delta: reply });
          writer.write({ type: 'text-end', id: textId });
        },
      });
      const { error } = await admin.from("business_assistant_messages").insert({ user_id: userId, role: "assistant", parts: [{ type: 'text', text: reply }], content: reply });
      if (error) console.error("[business-assistant] deterministic persist error", error);
      else await trimStoredHistory(admin, userId);
      return createUIMessageStreamResponse({ stream, headers: assistantCorsHeaders });
    }

    // --- Segundo cerebro: recuerdo semántico de la memoria del negocio ---
    let memoriaCerebro: Array<{ titulo: string; contenido: string; alcance: string; fuente: string | null }> = [];
    const question = last?.role === "user" ? textFromParts(last) : "";
    if (question) {
      const questionEmbedding = await embedText(question, apiKey);
      const recalled = await recallKnowledge(admin, questionEmbedding, userId, 6, 0.25);
      memoriaCerebro = recalled.map((m) => ({
        titulo: m.title,
        contenido: m.content,
        alcance: m.owner_user_id ? "privado" : "equipo",
        fuente: m.source,
      }));
    }

    const context = JSON.stringify({
      user: { email: userEmail, team_member: !!isTeam },
      memoria_cerebro: memoriaCerebro,
      screen_context: currentArea || null,
      negocio: businessProfile || null,
      finance_overview: overview,
      finanzas_calculadas: finanzasCalculadas,
      service_profitability: services || [],
      crm_growth: isTeam ? growth : null,
      recent_reviews: isTeam ? reviews : [],
      recent_opportunities: isTeam ? opportunities : [],
      clients: clients || [],
      recent_hours: hours || [],
      planner_tasks: tasks || [],
      integrations: integrations || null,
    }, null, 2);

    const initialRunId = getLovableAiGatewayRunId(req);
    const gateway = createLovableAiGatewayProvider(apiKey, initialRunId);
    const result = streamText({
      model: gateway("openai/gpt-5"),
      system: `Sos el asesor financiero y gerencial experto y el "segundo cerebro" del negocio dentro de Ferova OS. Actuás como un consultor de confianza Y como la memoria viva del negocio: das recomendaciones concretas y accionables, no solo reportás números. Respondé en español claro, cercano y sin jerga técnica innecesaria (quien te lee puede no saber de finanzas ni de tecnología).

## FORMATO DE RESPUESTA (IMPORTANTE)
Sé BREVE por defecto: la persona está trabajando, no leyendo un informe. Andá directo a la respuesta, sin preámbulos ("Claro que sí", "Con gusto…") ni resúmenes de la pregunta. Meta: 2 a 4 frases, o hasta 3 viñetas cortas. Da la conclusión primero y UNA acción concreta. Nada de listas largas, nada de repetir todos los números que ya ve en pantalla. SOLO extendéte más si la persona pide explícitamente el detalle ("explicame", "dame el paso a paso", "profundizá"). Si hay varias cosas, decí la más importante y ofrecé seguir ("¿querés que profundice en X?").

## TUS FUENTES DE VERDAD
1. FINANZAS CALCULADAS (campo "finanzas_calculadas"): el estado de resultados YA CALCULADO del período que la persona ve en pantalla (todo en COP). Son las MISMAS cifras del dashboard. Para CUALQUIER pregunta de utilidad, margen, punto de equilibrio o rentabilidad, USA ESTOS NÚMEROS directamente y con seguridad; NUNCA digas que te faltan datos si están aquí. (Solo si finanzas_calculadas viene null di que faltan y dónde cargarlos.) IMPORTANTE: "utilidad_operacional_real" es lo que de VERDAD quedó según los pagos reales; "utilidad_operacional" es la PROYECCIÓN con costos planeados. Cuando hables de utilidad, prioriza la REAL y usa la proyectada solo para comparar plan vs. realidad.
2. CONTEXTO DEL NEGOCIO (JSON abajo): el estado actual — servicios, pipeline, clientes, tareas, reseñas, integraciones.
3. MEMORIA DEL CEREBRO (campo "memoria_cerebro"): datos, decisiones, preferencias, políticas y aprendizajes que el equipo guardó a propósito. Es memoria DURADERA y confiable: priorizala y tratala como conocimiento establecido del negocio. Si algo en memoria_cerebro es relevante para la pregunta, úsalo explícitamente.

REGLA INQUEBRANTABLE: Usá EXCLUSIVAMENTE el contexto JSON (incluida memoria_cerebro) y el historial del chat -- ninguna otra fuente. Si falta un dato, decí exactamente qué falta y dónde cargarlo (ej. "no tengo tus gastos de este mes, cárgalos en Costos"); nunca inventes cifras, clientes, reseñas, servicios ni estados, y nunca des cifras genéricas del mercado como si fueran datos reales de este negocio.

## GUARDAR EN MEMORIA (herramienta guardar_en_memoria)
Sos responsable de mantener vivo el cerebro del negocio. Llamá a guardar_en_memoria cuando:
- La persona te pida recordar algo ("recuerda que...", "anota que...", "no se te olvide...").
- Se tome una decisión, se defina una política, un precio, un proceso, o una preferencia de un cliente.
- Surja un aprendizaje o un hecho duradero que servirá más adelante.
Reglas al guardar: respetá el ALCANCE DE MEMORIA permitido que se indica al final del contexto. Cuando puedas elegir, usá "global" si le sirve a todo el equipo y "privado" si es personal de quien te habla. Escribí el contenido claro y autocontenido (que se entienda sin este chat). Tras guardar, confirmá en UNA línea qué recordaste. NO guardes preguntas, cálculos ni charla pasajera, y no guardes dos veces lo mismo.

## CREAR DATOS REALES (herramientas de escritura)
Además de recordar, PODÉS registrar cosas por la persona: usá crear_tarea para pendientes accionables del Planner, registrar_gasto para pagos/egresos reales del negocio (solo si es admin), registrar_horas para el tiempo real trabajado (alimenta la rentabilidad por servicio y cliente), y crear_bloque_protegido para reservar tiempo en el Planner (bloques que no se mueven; interpretá días de la semana, hora de inicio/fin y si se repite, ej. "bloquea lunes y miércoles de 9 a 11 para deep work"). Antes de registrar un gasto, confirmá monto, concepto y categoría en tu respuesta; no inventes cifras ni categorías — si falta un dato clave, preguntalo. Tras crear algo, confirmá en UNA línea qué registraste.

## CÓMO ASESORÁS
Das asesoría sobre rentabilidad por servicio, salud del flujo de caja, pipeline de ventas, reseñas pendientes, cartera de clientes, gastos vs. ingresos y próximos pasos priorizados. Cuando algo se ve mal (margen negativo, cliente inactivo con saldo pendiente), decílo directo y proponé UNA acción concreta, no solo el diagnóstico. Priorizá: mejor 1-3 acciones claras que una lista larga. Cuando la acción corresponda a una de tus herramientas (guardar_en_memoria, crear_tarea, registrar_gasto, registrar_horas), EJECUTALA en vez de solo prometerla; solo no prometas acciones que NO podés hacer con tus herramientas.

NEGOCIO: ${businessProfile?.nombre_negocio || "este negocio"}
ALCANCE DE MEMORIA: ${memoriaScopeNote}

CONTEXTO ACTUAL DEL NEGOCIO:
${context}`,
      messages: await convertToModelMessages(messages),
      stopWhen: stepCountIs(4),
      tools: {
        guardar_en_memoria: tool({
          description: "Guarda en la memoria permanente del negocio (el 'segundo cerebro') un dato, decisión, preferencia, política, precio, proceso, hecho o aprendizaje que deba recordarse en el futuro. Úsala cuando la persona pida recordar algo ('recuerda que...', 'anota que...', 'no se te olvide...') o comparta información duradera importante. NO la uses para preguntas, cálculos ni charla pasajera.",
          inputSchema: jsonSchema<{ title: string; content: string; scope: "global" | "privado" }>({
            type: "object",
            additionalProperties: false,
            required: ["title", "content", "scope"],
            properties: {
              title: { type: "string", description: "Título corto y descriptivo de lo que se recuerda." },
              content: { type: "string", description: "El dato completo, claro y autocontenido (que se entienda sin ver este chat)." },
              scope: { type: "string", enum: ["global", "privado"], description: "'global' = todo el equipo lo verá (lo normal para cosas del negocio); 'privado' = solo esta persona." },
            },
          }),
          execute: async ({ title, content, scope }) => {
            // Los colaboradores solo pueden escribir en su memoria privada.
            const finalScope = isAdmin ? scope : "privado";
            const id = await rememberKnowledge(admin, { title, content, scope: finalScope, userId }, apiKey);
            return id ? { ok: true, alcance: finalScope } : { ok: false, message: "No se pudo guardar en la memoria." };
          },
        }),
        crear_tarea: tool({
          description: "Crea una tarea en el Planner del negocio. Úsala cuando la persona pida agendar, anotar un pendiente o recordar HACER algo accionable ('agenda...', 'tengo que...', 'ponme una tarea...'). NO la uses para datos financieros ni para simple memoria.",
          inputSchema: jsonSchema<{ title: string; priority?: "low" | "medium" | "high" | "urgent"; estimated_minutes?: number }>({
            type: "object",
            additionalProperties: false,
            required: ["title"],
            properties: {
              title: { type: "string", description: "Qué hay que hacer, claro y accionable." },
              priority: { type: "string", enum: ["low", "medium", "high", "urgent"], description: "Prioridad; si no se sabe, omitir (default media)." },
              estimated_minutes: { type: "number", description: "Minutos estimados; si no se sabe, omitir (default 30)." },
            },
          }),
          execute: async ({ title, priority, estimated_minutes }) => {
            const row: Record<string, unknown> = { user_id: userId, title };
            if (priority) row.priority = priority;
            if (typeof estimated_minutes === "number" && estimated_minutes > 0) row.estimated_minutes = Math.round(estimated_minutes);
            const { error } = await admin.from("planner_tasks").insert(row);
            return error ? { ok: false, message: error.message } : { ok: true, creado: "tarea" };
          },
        }),
        registrar_gasto: tool({
          description: "Registra un pago o egreso REAL del negocio en Finanzas (Pagos & Egresos). Úsala cuando la persona diga que pagó o gastó algo ('pagué...', 'registra un gasto de...', 'gasté...'). Solo egresos reales, no proyecciones. Requiere ser administrador.",
          inputSchema: jsonSchema<{ concepto: string; monto: number; categoria: "Herramientas" | "Salarios" | "Contratistas" | "Administrativo" | "Otros"; moneda?: "COP" | "USD"; fecha?: string }>({
            type: "object",
            additionalProperties: false,
            required: ["concepto", "monto", "categoria"],
            properties: {
              concepto: { type: "string", description: "Qué se pagó (ej. 'Licencia Figma mayo')." },
              monto: { type: "number", description: "Monto pagado (número, sin símbolos)." },
              categoria: { type: "string", enum: ["Herramientas", "Salarios", "Contratistas", "Administrativo", "Otros"], description: "Categoría del egreso." },
              moneda: { type: "string", enum: ["COP", "USD"], description: "Moneda; default COP." },
              fecha: { type: "string", description: "Fecha YYYY-MM-DD; si no se dice, hoy." },
            },
          }),
          execute: async ({ concepto, monto, categoria, moneda, fecha }) => {
            if (!isAdmin) return { ok: false, message: "Solo un administrador puede registrar egresos del negocio." };
            if (!(monto > 0)) return { ok: false, message: "El monto debe ser mayor a cero." };
            const hoy = new Date().toISOString().slice(0, 10);
            const { error } = await admin.from("finance_pagos_egresos").insert({
              id: `eg_asis_${Date.now().toString().slice(-9)}`,
              user_id: userId,
              fecha: fecha && /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? fecha : hoy,
              concepto,
              categoria,
              monto,
              moneda: moneda === "USD" ? "USD" : "COP",
            });
            return error ? { ok: false, message: error.message } : { ok: true, creado: "egreso" };
          },
        }),
        registrar_horas: tool({
          description: "Registra horas de trabajo REALES en Finanzas (registro de horas). Úsala cuando la persona diga cuánto tiempo dedicó a algo ('trabajé 2 horas en...', 'registra 90 minutos', 'dediqué media hora a...'). Las horas alimentan la rentabilidad por servicio y cliente. El cliente es opcional: si no se menciona, registrá igual las horas sin cliente. No la uses para estimaciones ni para tiempo planeado, solo para tiempo ya trabajado.",
          inputSchema: jsonSchema<{ horas: number; descripcion?: string; fecha?: string }>({
            type: "object",
            additionalProperties: false,
            required: ["horas"],
            properties: {
              horas: { type: "number", description: "Cantidad de horas en decimal (90 min = 1.5; media hora = 0.5). Debe ser mayor a cero." },
              descripcion: { type: "string", description: "En qué se trabajó (ej. 'Reunión con cliente X', 'Diseño de propuesta')." },
              fecha: { type: "string", description: "Fecha YYYY-MM-DD; si no se dice, hoy." },
            },
          }),
          execute: async ({ horas, descripcion, fecha }) => {
            if (!(horas > 0)) return { ok: false, message: "Las horas deben ser mayores a cero." };
            const hoy = new Date().toISOString().slice(0, 10);
            const { error } = await admin.from("finance_horas").insert({
              id: `hr_asis_${Date.now().toString().slice(-9)}`,
              user_id: userId,
              fecha: fecha && /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? fecha : hoy,
              horas,
              descripcion: descripcion || null,
            });
            return error ? { ok: false, message: error.message } : { ok: true, creado: "horas", horas };
          },
        }),
        crear_bloque_protegido: tool({
          description: "Crea uno o más bloques protegidos (tiempo reservado que el planificador NO moverá) en el Planner. Úsala cuando la persona quiera reservar/bloquear tiempo, sea recurrente o puntual: 'bloquea todos los lunes y miércoles de 9 a 11 para deep work', 'resérvame de 3 a 4 los viernes para el gym', 'bloquéame mañana de 2 a 3'. Interpretá del texto los días de la semana, la hora de inicio y fin, y hasta cuándo se repite.",
          inputSchema: jsonSchema<{ titulo: string; hora_inicio: string; hora_fin: string; dias?: number[]; fecha?: string; hasta?: string }>({
            type: "object",
            additionalProperties: false,
            required: ["titulo", "hora_inicio", "hora_fin"],
            properties: {
              titulo: { type: "string", description: "Qué se reserva (ej. 'Deep work', 'Gym', 'Reunión')." },
              hora_inicio: { type: "string", description: "Hora de inicio en formato 24h HH:mm, ej. '09:00'." },
              hora_fin: { type: "string", description: "Hora de fin en formato 24h HH:mm, ej. '11:00'. Debe ser mayor que la de inicio." },
              dias: { type: "array", items: { type: "number" }, description: "Días de la semana a repetir: 0=domingo, 1=lunes, 2=martes, 3=miércoles, 4=jueves, 5=viernes, 6=sábado. Omitir o vacío = bloque único para 'fecha' (o hoy)." },
              fecha: { type: "string", description: "Fecha YYYY-MM-DD para un bloque único; si se omite y no hay días, es hoy." },
              hasta: { type: "string", description: "Fecha final YYYY-MM-DD de la repetición (opcional; por defecto 90 días)." },
            },
          }),
          execute: async ({ titulo, hora_inicio, hora_fin, dias, fecha, hasta }) => {
            const tz = businessProfile?.zona_horaria || "America/Bogota";
            if (!/^\d{2}:\d{2}$/.test(hora_inicio) || !/^\d{2}:\d{2}$/.test(hora_fin) || hora_fin <= hora_inicio) {
              return { ok: false, message: "Horas inválidas: usá HH:mm 24h y que el fin sea mayor que el inicio." };
            }
            const today = new Date().toISOString().slice(0, 10);
            const startDate = fecha && /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? fecha : today;
            const days = Array.isArray(dias) ? dias.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6) : [];
            const validUntil = hasta && /^\d{4}-\d{2}-\d{2}$/.test(hasta) ? hasta : null;

            const dates: string[] = [];
            if (!days.length) {
              dates.push(startDate);
            } else {
              const horizon = new Date(`${validUntil || startDate}T12:00:00Z`);
              if (!validUntil) horizon.setUTCDate(horizon.getUTCDate() + 90);
              const cursor = new Date(`${startDate}T12:00:00Z`);
              for (let guard = 0; cursor <= horizon && guard < 400; guard++) {
                if (days.includes(cursor.getUTCDay())) dates.push(cursor.toISOString().slice(0, 10));
                cursor.setUTCDate(cursor.getUTCDate() + 1);
              }
            }
            if (!dates.length) return { ok: false, message: "No hay fechas que coincidan con los días indicados." };

            const rows = dates.map((d) => ({
              user_id: userId,
              title: titulo,
              starts_at: wallClockToUtcIso(`${d}T${hora_inicio}:00`, tz),
              ends_at: wallClockToUtcIso(`${d}T${hora_fin}:00`, tz),
              category: "meetings",
              protected: true,
              source: "assistant",
              recurrence_days: days,
              recurrence_until: validUntil,
            }));
            const { error } = await admin.from("planner_blocks").insert(rows);
            return error ? { ok: false, message: error.message } : { ok: true, creado: "bloque_protegido", cantidad: rows.length };
          },
        }),
      },
    });

    // Instrumentación de costo (Fase 4): registra los tokens al terminar la
    // generación, sin bloquear ni afectar el stream que ve la persona.
    result.usage.then((usage) => logAiUsage(admin, { userId, funcion: "business-assistant-chat", modelo: "openai/gpt-5", usage })).catch((e) => console.error("[ai-usage] business-assistant-chat", e));

    const response = result.toUIMessageStreamResponse({
      originalMessages: messages,
      headers: getLovableAiGatewayResponseHeaders(undefined, { ...assistantCorsHeaders, ...(initialRunId ? { "X-Lovable-AIG-Run-ID": initialRunId } : {}) }),
      onFinish: async ({ messages: finishedMessages }: any) => {
        const responseMessage = latestAssistant(finishedMessages || []);
        if (!responseMessage) return;
        const { error } = await admin.from("business_assistant_messages").insert({ user_id: userId, role: "assistant", parts: responseMessage.parts || [], content: textFromParts(responseMessage) });
        if (error) console.error("[business-assistant] assistant persist error", error);
        else await trimStoredHistory(admin, userId);
      },
    });

    return withLovableAiGatewayRunIdHeader(response, gateway, assistantCorsHeaders);
  } catch (err) {
    console.error("[business-assistant] error", err);
    return new Response(JSON.stringify({ ok: false, message: err instanceof Error ? err.message : String(err) }), { status: 500, headers: { ...assistantCorsHeaders, "Content-Type": "application/json" } });
  }
});
