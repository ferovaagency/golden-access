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

const ClassifySchema = z.object({
  detected_type: z.enum(["task","reminder","project","idea","note","purchase","event","client","finance","unknown"]),
  detected_priority: z.enum(["low","medium","high","urgent"]),
  detected_energy: z.enum(["low","medium","high"]),
  detected_category: z.enum(["deep_work","meetings","admin","creative","calls","learning","personal","breaks"]),
  detected_duration_min: z.number().int(),
  detected_deadline: z.string().nullable(),
  detected_client: z.string().nullable(),
  detected_project: z.string().nullable(),
  title: z.string(),
  reasoning: z.string(),
  confidence: z.number(),
});

const ACTIONABLE = new Set(["task","reminder","event","purchase","finance"]);

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
    if (entries.length === 0) return json({ ok: false, message: "Sin entradas" }, 400);

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
    const [{ data: clientRows }, { data: doneTasks }] = await Promise.all([
      admin.from("finance_clientes").select("id,nombre").eq("user_id", userId),
      admin.from("planner_tasks").select("category,client_ref,actual_minutes").eq("user_id", userId).eq("status", "done").not("actual_minutes", "is", null).limit(300),
    ]);
    const clients = (clientRows || []) as { id: string; nombre: string }[];
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

    function resolveClientRef(detectedName: string | null): string | null {
      if (!detectedName) return null;
      const normalized = detectedName.trim().toLowerCase();
      const exact = clients.find((c) => c.nombre.trim().toLowerCase() === normalized);
      if (exact) return exact.id;
      const partial = clients.find((c) => normalized.includes(c.nombre.trim().toLowerCase()) || c.nombre.trim().toLowerCase().includes(normalized));
      return partial?.id || null;
    }

    const clientsContext = clients.length ? `Clientes reales del negocio (usa EXACTAMENTE uno de estos nombres si el texto se refiere a alguno; si no coincide con ninguno, deja detected_client en null): ${clients.map((c) => c.nombre).join(", ")}.` : "Todavía no hay clientes cargados en el sistema.";
    const durationContext = Object.keys(avgByCategory).length
      ? `Duración histórica REAL de esta persona por categoría (úsala como ancla salvo que la tarea claramente sea distinta): ${Object.entries(avgByCategory).map(([cat, min]) => `${cat}=${min}min`).join(", ")}.`
      : "Todavía no hay historial de duración real -- estima de forma conservadora.";

    const clientDurationContext = Object.keys(avgByClient).length
      ? `Historical duration by client: ${Object.entries(avgByClient).map(([client, min]) => `${client}=${min}min`).join(', ')}. Use it as the primary estimate when the task names that client.`
      : 'No client-specific duration history yet.';
    const results = [] as any[];
    for (const line of entries.slice(0, 20)) {
      let extracted: z.infer<typeof ClassifySchema> | null = null;
      try {
        if (!gateway) throw new Error("AI gateway is not configured");
        const { output } = await generateText({
          model: gateway("google/gemini-3.5-flash"),
          output: Output.object({ schema: ClassifySchema }),
          system: `You are an executive assistant that classifies brain-dump lines from a business owner. Respond in the same language as the input. Estimate a realistic duration (5-240 min). Set priority=urgent only for explicit deadlines <48h or 'urgent/asap'. Detect deadline as ISO if the text mentions a date/time. Extract client/project names if mentioned. Category deep_work=focus/writing/design, admin=paperwork/taxes/emails, calls=phone/whatsapp/meet, creative=ideas/content, learning=read/study, personal=life. Confidence 0-1.\n${clientsContext}\n${durationContext}\n${clientDurationContext}`,
          prompt: `Line: """${line}"""\nToday: ${new Date().toISOString()}`,
        });
        extracted = output as any;
      } catch (e) {
        console.error("[planner-classify] model error", e);
      }
      const fallback = {
        detected_type: "task" as const,
        detected_priority: "medium" as const,
        detected_energy: "medium" as const,
        detected_category: "admin" as const,
        detected_duration_min: 30,
        detected_deadline: null,
        detected_client: null,
        detected_project: null,
        title: line,
        reasoning: key ? "Fallback classification after AI response failure." : "Clasificación básica: la IA aún no está configurada en este despliegue.",
        confidence: 0.3,
      };
      const c = extracted ?? fallback;

      const { data: inboxRow, error: ierr } = await admin.from("planner_inbox").insert({
        user_id: userId,
        raw_text: line,
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
      if (ierr) { console.error("[planner-classify] inbox insert", ierr); continue; }

      let task: any = null;
      if (ACTIONABLE.has(c.detected_type)) {
        const { data: t, error: terr } = await admin.from("planner_tasks").insert({
          user_id: userId,
          title: c.title || line,
          category: c.detected_category,
          priority: c.detected_priority,
          energy_required: c.detected_energy,
          estimated_minutes: c.detected_duration_min,
          deadline: c.detected_deadline,
          project_ref: c.detected_project,
          client_ref: resolveClientRef(c.detected_client),
          source_inbox_id: inboxRow.id,
          ai_notes: c.reasoning,
        }).select("*").single();
        if (!terr && t) {
          task = t;
          await admin.from("planner_inbox").update({ task_id: t.id }).eq("id", inboxRow.id);
        }
      }
      results.push({ inbox: inboxRow, task });
    }
    return json({ ok: true, results });
  } catch (err) {
    console.error("[planner-classify] error", err);
    return json({ ok: false, message: err instanceof Error ? err.message : String(err) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
