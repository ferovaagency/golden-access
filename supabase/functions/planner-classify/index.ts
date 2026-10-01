// Classifies raw brain-dump text into structured planner items using Lovable AI.
// - Accepts { text } (single or newline separated) OR { entries: string[] }
// - For each line, asks the model to extract type/priority/energy/duration/deadline/etc.
// - Inserts a row into planner_inbox; if the item is actionable (task/reminder/event/purchase),
//   also creates a planner_task and links back via source_inbox_id.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { generateText, Output } from "npm:ai";
import { z } from "npm:zod";
import { createLovableAiGatewayProvider } from "../_shared/ai-gateway.ts";
import { logAiUsage, sumUsage } from "../_shared/ai-usage.ts";
import { financialImpactForClient, loadClientRevenueScores } from "../_shared/client-revenue.ts";
import { matchClientName, parseCapture, todayInZone } from "../_shared/task-parser.ts";

const ClassifySchema = z.object({
  detected_type: z.enum(["task","reminder","project","idea","note","purchase","event","client","finance","unknown"]),
  detected_priority: z.enum(["low","medium","high","urgent"]),
  detected_energy: z.enum(["low","medium","high"]),
  detected_category: z.enum(["deep_work","meetings","admin","creative","calls","learning","personal","breaks"]),
  detected_duration_min: z.number().int(),
  financial_impact: z.number().int().min(1).max(5),
  client_impact: z.number().int().min(1).max(5),
  risk_score: z.number().int().min(1).max(5),
  execution_ease: z.number().int().min(1).max(5),
  detected_deadline: z.string().nullable(),
  detected_client: z.string().nullable(),
  detected_project: z.string().nullable(),
  title: z.string(),
  reasoning: z.string(),
  confidence: z.number(),
});

/** Interpretación de TODO el texto en una sola llamada: varias tareas por línea,
 *  cliente y fecha heredados por línea, servicio detectado. */
const BatchSchema = z.object({
  tareas: z.array(ClassifySchema.extend({
    detected_service: z.string().nullable(),
    /** Línea original de la que salió, para la bandeja. */
    source_line: z.string(),
  })).max(40),
});

const ACTIONABLE = new Set(["task","reminder","event","purchase","finance"]);

/** Tope del modo commit: debe cubrir el import completo (src/lib/notionImport.ts). */
const MAX_COMMIT_DRAFTS = 200;
/** Filas persistidas en paralelo. Mantiene el emparejamiento inbox↔tarea exacto
 *  (a diferencia de un insert masivo, cuyo orden de retorno no está garantizado)
 *  sin que 200 tareas tarden minutos en fila india. */
const WRITE_CONCURRENCY = 10;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization") || "";
    const token = auth.replace("Bearer ", "");
    if (!token) return json({ ok: false, message: "No autenticado" }, 401);

    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: userData, error: uerr } = await userClient.auth.getUser(token);
    if (uerr || !userData.user) return json({ ok: false, message: "Sesión inválida" }, 401);
    const userId = userData.user.id;

    const body = await req.json();
    const raw = typeof body?.text === "string" ? body.text : "";
    const entries: string[] = Array.isArray(body?.entries) ? body.entries : raw.split("\n").map((l: string) => l.trim()).filter(Boolean);
    // El modo commit manda `drafts` ya confirmados y ningún texto: exigir
    // entradas aquí rechazaba el guardado del import con 400 "Sin entradas".
    const hasIncomingDrafts = Array.isArray(body?.drafts) && body.drafts.length > 0;
    // Un lote sin líneas útiles (todo espacios/viñetas vacías) no es un error:
    // se responde vacío para que el import siga con las demás tandas.
    if (!hasIncomingDrafts && entries.length === 0) {
      return json({ ok: true, results: [], drafts: [], clients: [] }, 200);
    }

    const key = Deno.env.get("LOVABLE_API_KEY");
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    // AI enrichment is optional at runtime. A missing hosted key must never
    // block the owner from turning a brain dump into editable planner tasks.
    const gateway = key ? createLovableAiGatewayProvider(key) : null;

    // Contexto real para que la IA no adivine en el vacío:
    // - Clientes reales, para resolver detected_client a un client_ref válido
    //   (antes se guardaba el texto suelto de la IA, que casi nunca coincidía
    //   con un id real y la insignia de cliente nunca aparecía en el bloque).
    // - Duración histórica real por categoría, para anclar la estimación de
    //   tiempo a lo que de verdad se demora esta persona, no a un promedio
    //   genérico.
    const [{ data: clientRows }, { data: serviceRows }, { data: doneTasks }, { data: profile }, revenueScores] = await Promise.all([
      admin.from("finance_clientes").select("id,nombre").eq("user_id", userId),
      admin.from("finance_servicios").select("id,nombre").eq("user_id", userId),
      admin.from("planner_tasks").select("category,client_ref,service_ref,actual_minutes").eq("user_id", userId).eq("status", "done").not("actual_minutes", "is", null).limit(300),
      admin.from("business_profile").select("zona_horaria").eq("user_id", userId).maybeSingle(),
      // Pareto real: impacto financiero por cliente según ventas de los últimos 90 días.
      loadClientRevenueScores(admin, userId),
    ]);
    const clients = (clientRows || []) as { id: string; nombre: string }[];
    const services = (serviceRows || []) as { id: string; nombre: string }[];
    // "Mañana" se calcula en la zona de la persona. A las 10 pm en Bogotá ya es
    // el día siguiente en UTC: con la fecha UTC, "mañana" caía un día tarde.
    const timeZone = (profile?.zona_horaria as string) || "America/Bogota";
    const today = todayInZone(timeZone);
    // Duración real por servicio: es el mejor predictor de cuánto toma una
    // tarea (un reporte mensual de SEO se parece a otro reporte mensual de SEO).
    const avgByService: Record<string, number> = {};
    for (const service of services) {
      const history = (doneTasks || []).filter((task: any) => task.service_ref === service.id) as { actual_minutes: number }[];
      if (history.length) avgByService[service.id] = Math.max(5, Math.round(history.reduce((sum, task) => sum + task.actual_minutes, 0) / history.length / 5) * 5);
    }
    const avgByCategory: Record<string, number> = {};
    const sums: Record<string, { total: number; count: number }> = {};
    for (const t of (doneTasks || []) as { category: string; actual_minutes: number }[]) {
      const bucket = sums[t.category] || { total: 0, count: 0 };
      bucket.total += t.actual_minutes;
      bucket.count += 1;
      sums[t.category] = bucket;
    }
    for (const [category, { total, count }] of Object.entries(sums)) avgByCategory[category] = Math.round(total / count);
    const avgByClient: Record<string, number> = {};
    for (const client of clients) {
      const history = (doneTasks || []).filter((task: any) => task.client_ref === client.id) as { actual_minutes: number }[];
      if (history.length) avgByClient[client.nombre] = Math.round(history.reduce((sum, task) => sum + task.actual_minutes, 0) / history.length);
    }

    // Tolerante a errores de tecleo ("roecket" → El Rocket); null si hay empate.
    const resolveClientRef = (detectedName: string | null): string | null => matchClientName(detectedName, clients)?.id ?? null;
    const resolveServiceRef = (detectedName: string | null): string | null => matchClientName(detectedName, services)?.id ?? null;

    const clientsContext = clients.length ? `Clientes reales del negocio (usa EXACTAMENTE uno de estos nombres si el texto se refiere a alguno; si no coincide con ninguno, deja detected_client en null): ${clients.map((c) => c.nombre).join(", ")}.` : "Todavía no hay clientes cargados en el sistema.";
    const durationContext = Object.keys(avgByCategory).length
      ? `Duración histórica REAL de esta persona por categoría (úsala como ancla salvo que la tarea claramente sea distinta): ${Object.entries(avgByCategory).map(([cat, min]) => `${cat}=${min}min`).join(", ")}.`
      : "Todavía no hay historial de duración real -- estima de forma conservadora.";

    const clientDurationContext = Object.keys(avgByClient).length
      ? `Historical duration by client: ${Object.entries(avgByClient).map(([client, min]) => `${client}=${min}min`).join(', ')}. Use it as the primary estimate when the task names that client.`
      : 'No client-specific duration history yet.';
    // Draft = clasificación ya resuelta pero todavía NO persistida. Permite
    // que la UI muestre cliente, fecha y duración detectados para confirmar o
    // corregir antes de crear nada (modo `preview`), y que después devuelva
    // esos mismos drafts corregidos para materializarlos (modo commit).
    type Draft = {
      line: string;
      title: string;
      detected_type: string;
      detected_priority: string;
      detected_energy: string;
      detected_category: string;
      detected_duration_min: number;
      financial_impact: number;
      client_impact: number;
      risk_score: number;
      execution_ease: number;
      detected_deadline: string | null;
      detected_client: string | null;
      detected_project: string | null;
      client_ref: string | null;
      detected_service: string | null;
      service_ref: string | null;
      scheduled_for: string | null;
      reasoning: string;
      confidence: number;
    };

    const incomingDrafts: Draft[] | null = hasIncomingDrafts ? body.drafts as Draft[] : null;
    const drafts: Draft[] = [];
    const usos: any[] = [];

    if (incomingDrafts) {
      // Confirmación del usuario: se respeta lo que él corrigió y sólo se
      // sanean los campos que la base necesita bien tipados.
      // El tope aquí es el mismo del import (200): no hay llamadas a IA en
      // este camino, así que truncar a 20 sólo perdía tareas ya revisadas.
      for (const d of incomingDrafts.slice(0, MAX_COMMIT_DRAFTS)) {
        // Si la persona cambió el cliente en la revisión (o vino del import de
        // Notion con el 3 neutro), el impacto financiero sale de las ventas.
        const revenueImpact = financialImpactForClient(revenueScores, d.client_ref || null);
        const financialImpact = revenueImpact !== null && (Number(d.financial_impact) || 3) === 3 ? revenueImpact : (Number(d.financial_impact) || 3);
        drafts.push({
          ...d,
          financial_impact: financialImpact,
          title: String(d.title || d.line || "").slice(0, 300),
          detected_duration_min: Math.min(600, Math.max(5, Number(d.detected_duration_min) || 30)),
          client_ref: d.client_ref || null,
          detected_service: d.detected_service || null,
          service_ref: d.service_ref || null,
          scheduled_for: d.scheduled_for || null,
        });
      }
    } else {
      // Modelo de interpretación (ver Notion · Bandeja de conocimiento IA ·
      // "Planner · modelo de interpretación de capturas"):
      //   1. Primero un parser determinista separa líneas en tareas, hereda el
      //      cliente del prefijo "Cliente:" y la fecha del final de la línea,
      //      y resuelve clientes con tolerancia a errores de tecleo.
      //   2. Si hay IA, recibe el texto completo MÁS ese pre-análisis y
      //      devuelve todas las tareas en una sola llamada (categoría,
      //      duración, prioridad, servicio, puntajes). Una tarea por línea era
      //      el error de antes: "Cliente: a, b y c para mañana" son tres.
      //   3. Si la IA falla o no está configurada, el pre-análisis ES el
      //      resultado: cliente y fecha correctos, el resto en valores neutros.
      const textoCompleto = entries.join("\n").trim();
      const parsed = parseCapture(textoCompleto, today).slice(0, 40);
      const preAnalysis = parsed.map((t, index) => `${index + 1}. "${t.title}" | cliente: ${t.client_text ?? "—"} | fecha: ${t.deadline ?? "—"} | línea: "${t.line}"`).join("\n");

      type AiTask = z.infer<typeof BatchSchema>["tareas"][number];
      let aiTasks: AiTask[] | null = null;
      if (gateway) {
        try {
          const { output, usage } = await generateText({
            model: gateway("google/gemini-2.5-flash"),
            output: Output.object({ schema: BatchSchema }),
            system: `Eres la asistente ejecutiva de una dueña de agencia. Convierte su captura (brain dump) en tareas accionables. Responde en el idioma del texto.
REGLAS DE INTERPRETACIÓN:
- Una línea puede traer varias tareas separadas por comas, punto y coma o "y". Devuelve una por tarea. NO inventes tareas ni las partas en pasos.
- Lo que va antes de ":" o ";" al inicio de una línea es el cliente de TODAS las tareas de esa línea.
- Una fecha al final de la línea ("para mañana", "el viernes", "antes del 15/10") aplica a todas las tareas de la línea que no tengan la suya. Fechas relativas se calculan desde HOY = ${today} (zona ${timeZone}). detected_deadline en formato YYYY-MM-DD o null.
- El título es la tarea sin el nombre del cliente ni la fecha ("Reporte mensual", no "El Rocket: reporte mensual para mañana").
- detected_client: usa EXACTAMENTE uno de los clientes reales aunque esté mal escrito en el texto; si no corresponde a ninguno, null. ${clientsContext}
- detected_service: el servicio real que mejor describe la tarea, EXACTAMENTE uno de: ${services.length ? services.map((x) => x.nombre).join(", ") : "(no hay servicios cargados: deja null)"}; null si ninguno aplica.
- Duración realista en minutos (5-240). ${durationContext} ${clientDurationContext}
- priority=urgent sólo con entrega < 48 h o "urgente/ya". Categorías: deep_work=foco/escritura/diseño, admin=papeleo/impuestos/correos, calls=llamadas/whatsapp/reunión, creative=ideas/contenido, learning=leer/estudiar, personal=vida.
- financial_impact, client_impact, risk_score y execution_ease de 1 a 5 sólo con evidencia explícita; 3 si no la hay. Son sugerencias editables.
- source_line: la línea original de la que salió la tarea. confidence 0-1.`,
            prompt: `TEXTO:\n"""${textoCompleto}"""\n\nPRE-ANÁLISIS DETERMINISTA (úsalo como base; corrige sólo si el texto lo contradice):\n${preAnalysis || "(sin tareas detectadas)"}`,
          });
          usos.push(usage);
          const tareas = (output as z.infer<typeof BatchSchema>)?.tareas ?? [];
          if (tareas.length) aiTasks = tareas;
        } catch (e) {
          console.error("[planner-classify] interpretación con IA", e);
        }
      }

      type Classified = z.infer<typeof ClassifySchema>;
      const baseline: Pick<Classified, "detected_type" | "detected_priority" | "detected_energy" | "detected_category" | "detected_duration_min" | "financial_impact" | "client_impact" | "risk_score" | "execution_ease" | "detected_project" | "confidence"> = {
        detected_type: "task",
        detected_priority: "medium",
        detected_energy: "medium",
        detected_category: "admin",
        detected_duration_min: 30,
        financial_impact: 3,
        client_impact: 3,
        risk_score: 3,
        execution_ease: 3,
        detected_project: null,
        confidence: 0.5,
      };
      const pushDraft = (c: {
        line: string; title: string; detected_client: string | null; detected_service: string | null; detected_deadline: string | null; reasoning: string;
      } & Partial<typeof baseline>) => {
        const merged = { ...baseline, ...c };
        const clientRef = resolveClientRef(merged.detected_client);
        const serviceRef = resolveServiceRef(merged.detected_service);
        // El historial del servicio pesa más que cualquier estimación de texto.
        const duration = serviceRef && avgByService[serviceRef] ? avgByService[serviceRef] : merged.detected_duration_min;
        const revenueImpact = financialImpactForClient(revenueScores, clientRef);
        const financialImpact = revenueImpact === null ? merged.financial_impact : Math.max(revenueImpact, merged.financial_impact >= 5 ? 5 : 1);
        drafts.push({
          line: merged.line,
          title: (merged.title || merged.line).slice(0, 300),
          detected_type: merged.detected_type,
          detected_priority: merged.detected_priority,
          detected_energy: merged.detected_energy,
          detected_category: merged.detected_category,
          detected_duration_min: Math.min(600, Math.max(5, Number(duration) || 30)),
          financial_impact: financialImpact,
          client_impact: merged.client_impact,
          risk_score: merged.risk_score,
          execution_ease: merged.execution_ease,
          detected_deadline: merged.detected_deadline,
          detected_client: clientRef ? clients.find((x) => x.id === clientRef)?.nombre ?? merged.detected_client : merged.detected_client,
          detected_project: merged.detected_project,
          client_ref: clientRef,
          detected_service: serviceRef ? services.find((x) => x.id === serviceRef)?.nombre ?? merged.detected_service : merged.detected_service,
          service_ref: serviceRef,
          // Una fecha detectada es una intención de agenda, no sólo una fecha
          // límite: así "el próximo viernes" queda programado de inmediato.
          scheduled_for: merged.detected_deadline ? merged.detected_deadline.slice(0, 10) : null,
          reasoning: merged.reasoning,
          confidence: merged.confidence,
        });
      };

      if (aiTasks) {
        for (const t of aiTasks) {
          pushDraft({
            line: t.source_line || t.title,
            title: t.title,
            detected_type: t.detected_type,
            detected_priority: t.detected_priority,
            detected_energy: t.detected_energy,
            detected_category: t.detected_category,
            detected_duration_min: t.detected_duration_min,
            financial_impact: t.financial_impact,
            client_impact: t.client_impact,
            risk_score: t.risk_score,
            execution_ease: t.execution_ease,
            detected_deadline: t.detected_deadline ? t.detected_deadline.slice(0, 10) : null,
            detected_client: t.detected_client,
            detected_service: t.detected_service,
            detected_project: t.detected_project,
            reasoning: t.reasoning,
            confidence: t.confidence,
          });
        }
      } else {
        for (const t of parsed) {
          pushDraft({
            line: t.line,
            title: t.title,
            detected_client: t.client_text,
            detected_service: null,
            detected_deadline: t.deadline,
            reasoning: key ? "Interpretación básica: la IA no respondió; cliente y fecha salen del texto." : "Interpretación básica: la IA aún no está configurada en este despliegue.",
            confidence: 0.4,
          });
        }
      }
    }

    // Una fila por invocación, con los tokens de las hasta 20 líneas sumados:
    // 20 filas idénticas dirían lo mismo y romperían el percentil por llamada.
    logAiUsage(admin, { userId, funcion: "planner-classify", modelo: "google/gemini-2.5-flash", usage: sumUsage(usos) })
      .catch((e) => console.error("[ai-usage] planner-classify", e));

    // Modo preview: se devuelve la interpretación sin escribir absolutamente
    // nada, junto con los clientes reales para que la UI ofrezca el selector.
    if (body?.preview === true) {
      return json({ ok: true, preview: true, drafts, clients, services, service_avg_minutes: avgByService });
    }

    // Persiste un borrador y devuelve el par inbox↔tarea, o el motivo del fallo.
    // Antes los errores por fila se descartaban con `continue`: el import podía
    // guardar cero tareas y aun así responder ok, sin rastro para la persona.
    async function persistDraft(c: Draft): Promise<{ inbox: any; task: any } | { failed: string }> {
      const { data: inboxRow, error: ierr } = await admin.from("planner_inbox").insert({
        user_id: userId,
        raw_text: c.line,
        detected_type: c.detected_type,
        detected_priority: c.detected_priority,
        detected_energy: c.detected_energy,
        detected_category: c.detected_category,
        detected_duration_min: c.detected_duration_min,
        detected_deadline: c.detected_deadline,
        detected_client: c.detected_client,
        detected_project: c.detected_project,
        ai_confidence: c.confidence,
        ai_reasoning: c.reasoning,
        processed: ACTIONABLE.has(c.detected_type),
      }).select("*").single();
      if (ierr || !inboxRow) {
        console.error("[planner-classify] inbox insert", ierr);
        return { failed: `${c.title || c.line}: ${ierr?.message || "no se pudo registrar"}` };
      }

      let task: any = null;
      if (ACTIONABLE.has(c.detected_type)) {
        const { data: t, error: terr } = await admin.from("planner_tasks").insert({
          user_id: userId,
          title: c.title || c.line,
          category: c.detected_category,
          priority: c.detected_priority,
          energy_required: c.detected_energy,
          estimated_minutes: c.detected_duration_min,
          financial_impact: c.financial_impact,
          client_impact: c.client_impact,
          risk_score: c.risk_score,
          execution_ease: c.execution_ease,
          deadline: c.detected_deadline,
          scheduled_for: c.scheduled_for,
          project_ref: c.detected_project,
          client_ref: c.client_ref,
          service_ref: c.service_ref || null,
          source_inbox_id: inboxRow.id,
          ai_notes: c.reasoning,
        }).select("*").single();
        if (terr || !t) {
          console.error("[planner-classify] task insert", terr);
          return { failed: `${c.title || c.line}: ${terr?.message || "no se pudo crear la tarea"}` };
        }
        task = t;
        await admin.from("planner_inbox").update({ task_id: t.id }).eq("id", inboxRow.id);
      }
      return { inbox: inboxRow, task };
    }

    const results = [] as any[];
    const errors = [] as string[];
    for (let i = 0; i < drafts.length; i += WRITE_CONCURRENCY) {
      const settled = await Promise.all(drafts.slice(i, i + WRITE_CONCURRENCY).map(persistDraft));
      for (const outcome of settled) {
        if ("failed" in outcome) errors.push(outcome.failed);
        else results.push(outcome);
      }
    }

    // Nada guardado es un fallo, no un éxito vacío: la UI debe poder decirlo.
    if (!results.length && errors.length) {
      return json({ ok: false, message: `No se pudo guardar ninguna tarea. ${errors[0]}`, results, errors }, 500);
    }
    return json({
      ok: true,
      results,
      errors,
      message: errors.length ? `Guardé ${results.length}; fallaron ${errors.length}.` : undefined,
    });
  } catch (err) {
    console.error("[planner-classify] error", err);
    return json({ ok: false, message: err instanceof Error ? err.message : String(err) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
