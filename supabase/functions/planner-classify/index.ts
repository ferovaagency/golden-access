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
    if (!key) return json({ ok: false, message: "LOVABLE_API_KEY missing" }, 500);
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const gateway = createLovableAiGatewayProvider(key);

    const results = [] as any[];
    for (const line of entries.slice(0, 20)) {
      let extracted: z.infer<typeof ClassifySchema> | null = null;
      try {
        const { output } = await generateText({
          model: gateway("google/gemini-3.5-flash"),
          output: Output.object({ schema: ClassifySchema }),
          system: "You are an executive assistant that classifies brain-dump lines from a business owner. Respond in the same language as the input. Estimate a realistic duration (5-240 min). Set priority=urgent only for explicit deadlines <48h or 'urgent/asap'. Detect deadline as ISO if the text mentions a date/time. Extract client/project names if mentioned. Category deep_work=focus/writing/design, admin=paperwork/taxes/emails, calls=phone/whatsapp/meet, creative=ideas/content, learning=read/study, personal=life. Confidence 0-1.",
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
        reasoning: "Fallback classification.",
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
          client_ref: c.detected_client,
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
