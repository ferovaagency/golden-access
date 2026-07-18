// Rebuilds a user's day-plan intelligently.
// Input: { date?: "YYYY-MM-DD" }
// - Loads pending tasks, existing (locked) blocks, learned behavior, working hours.
// - Asks the model for a ranked schedule with reasoning per block.
// - Deletes previous AI-generated (non-locked) blocks for that day and inserts new ones.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { generateText, Output } from "npm:ai";
import { z } from "npm:zod";
import { createLovableAiGatewayProvider } from "../_shared/ai-gateway.ts";

const PlanSchema = z.object({
  blocks: z.array(z.object({
    title: z.string(),
    category: z.enum(["deep_work","meetings","admin","creative","calls","learning","personal","breaks"]),
    start_hour: z.number(),
    start_minute: z.number(),
    end_hour: z.number(),
    end_minute: z.number(),
    task_ids: z.array(z.string()),
    reasoning: z.string(),
  })),
  summary: z.string(),
});

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

    const body = await req.json().catch(() => ({}));
    const date = (body?.date as string) || new Date().toISOString().slice(0, 10);
    const dayStart = new Date(`${date}T00:00:00`).toISOString();
    const dayEnd = new Date(`${date}T23:59:59`).toISOString();

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const [{ data: tasks }, { data: existingBlocks }, { data: behavior }] = await Promise.all([
      admin.from("planner_tasks").select("id,title,category,priority,energy_required,estimated_minutes,deadline,status").eq("user_id", userId).in("status", ["backlog","scheduled","postponed"]).order("priority", { ascending: false }).limit(40),
      admin.from("planner_blocks").select("id,title,starts_at,ends_at,category,is_locked").eq("user_id", userId).gte("starts_at", dayStart).lte("starts_at", dayEnd),
      admin.from("planner_behavior").select("metric_key,metric_value").eq("user_id", userId),
    ]);

    const key = Deno.env.get("LOVABLE_API_KEY");
    if (!key) return json({ ok: false, message: "LOVABLE_API_KEY missing" }, 500);
    const gateway = createLovableAiGatewayProvider(key);

    const locked = (existingBlocks || []).filter((b: any) => b.is_locked || b.source === "google");
    const prompt = `Design an optimal work day for ${date}.\n\nPENDING TASKS (id · title · category · priority · energy · est_min · deadline):\n${(tasks || []).map((t: any) => `- ${t.id} · ${t.title} · ${t.category} · ${t.priority} · ${t.energy_required} · ${t.estimated_minutes}min · ${t.deadline || "-"}`).join("\n") || "(none)"}\n\nLOCKED EVENTS (do not move):\n${locked.map((b: any) => `- ${b.title} ${b.starts_at}→${b.ends_at}`).join("\n") || "(none)"}\n\nLEARNED PATTERNS:\n${(behavior || []).map((b: any) => `- ${b.metric_key}: ${JSON.stringify(b.metric_value)}`).join("\n") || "(none)"}\n\nRules:\n- Working hours 09:00–19:00 unless behavior says otherwise.\n- Deep work + high-energy tasks in the morning (09–12).\n- Admin/calls after 14:00.\n- Group similar categories.\n- Insert 15min breaks between long blocks.\n- Do NOT double-book locked events.\n- Only reference task ids provided above.\n- Give a one-line reasoning per block.`;

    let plan: z.infer<typeof PlanSchema> | null = null;
    try {
      const { output } = await generateText({
        model: gateway("google/gemini-3.5-flash"),
        output: Output.object({ schema: PlanSchema }),
        system: "You are Ferova's executive scheduler. Return the JSON schema exactly.",
        prompt,
      });
      plan = output as any;
    } catch (e) {
      console.error("[planner-plan-day] model error", e);
      return json({ ok: false, message: "AI planner failed" }, 502);
    }

    // Remove previous AI blocks for the day (keep locked/google)
    await admin.from("planner_blocks").delete().eq("user_id", userId).eq("source", "ai").gte("starts_at", dayStart).lte("starts_at", dayEnd);

    const inserts = (plan?.blocks || []).map((b) => {
      const starts = new Date(`${date}T${String(b.start_hour).padStart(2, "0")}:${String(b.start_minute).padStart(2, "0")}:00`);
      const ends = new Date(`${date}T${String(b.end_hour).padStart(2, "0")}:${String(b.end_minute).padStart(2, "0")}:00`);
      return {
        user_id: userId,
        title: b.title,
        category: b.category,
        starts_at: starts.toISOString(),
        ends_at: ends.toISOString(),
        task_ids: b.task_ids,
        source: "ai",
        notes: b.reasoning,
      };
    });
    if (inserts.length) await admin.from("planner_blocks").insert(inserts);

    // Mark scheduled tasks
    const scheduledIds = Array.from(new Set((plan?.blocks || []).flatMap((b) => b.task_ids)));
    if (scheduledIds.length) await admin.from("planner_tasks").update({ status: "scheduled", scheduled_for: dayStart }).in("id", scheduledIds).eq("user_id", userId);

    return json({ ok: true, summary: plan?.summary, blocks: inserts });
  } catch (err) {
    console.error("[planner-plan-day] error", err);
    return json({ ok: false, message: err instanceof Error ? err.message : String(err) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
