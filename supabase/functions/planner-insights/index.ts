// Proactively generates "what you may not be seeing" insights and daily briefings.
// Input: { kind?: "insights" | "morning" | "evening" }
// Reads finance overview, CRM opportunities, planner tasks, recent behavior; asks the model
// for a compact list of insights/briefing bullets and upserts into planner_insights/planner_briefings.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { generateText, Output } from "npm:ai";
import { z } from "npm:zod";
import { createLovableAiGatewayProvider } from "../_shared/ai-gateway.ts";

const InsightsSchema = z.object({
  insights: z.array(z.object({
    kind: z.string(),
    severity: z.enum(["info","warn","risk","opportunity"]),
    title: z.string(),
    body: z.string(),
    action_hint: z.string(),
    action_route: z.string(),
  })).max(8),
});

const BriefingSchema = z.object({
  headline: z.string(),
  bullets: z.array(z.string()).max(8),
  suggested_focus: z.string(),
  estimated_workload_minutes: z.number(),
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
    const kind = (body?.kind as string) || "insights";

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const [{ data: overview }, { data: services }, { data: opps }, { data: tasks }, { data: blocks }] = await Promise.all([
      admin.from("business_overview").select("*").eq("user_id", userId).maybeSingle(),
      admin.from("finance_service_profitability").select("servicio_nombre, ingresos_brutos, margen_bruto").eq("user_id", userId).order("margen_bruto", { ascending: true }).limit(10),
      admin.from("crm_oportunidades").select("nombre_contacto,empresa,estado,valor_estimado,siguiente_accion,updated_at").order("updated_at", { ascending: false }).limit(15),
      admin.from("planner_tasks").select("id,title,category,priority,estimated_minutes,deadline,status,postponed_count").eq("user_id", userId).in("status", ["backlog","scheduled","postponed"]).limit(40),
      admin.from("planner_blocks").select("title,category,starts_at,ends_at").eq("user_id", userId).gte("starts_at", new Date().toISOString().slice(0, 10) + "T00:00:00").limit(30),
    ]);

    const key = Deno.env.get("LOVABLE_API_KEY");
    if (!key) return json({ ok: false, message: "LOVABLE_API_KEY missing" }, 500);
    const gateway = createLovableAiGatewayProvider(key);
    const context = JSON.stringify({ overview, services, opps, tasks, blocks }, null, 0);

    if (kind === "insights") {
      const { output } = await generateText({
        model: gateway("google/gemini-3.5-flash"),
        output: Output.object({ schema: InsightsSchema }),
        system: "You are the executive insights engine for Ferova OS. Detect: cash-flow risk, late follow-ups, projects over budget/hours, inactive clients, upcoming deadlines, overload, too many meetings, lack of deep work, revenue concentration, growth opportunities. Only use the provided context. Spanish. Each insight is 1-2 short sentences. action_route uses the tab slug: home, planner, ventas, gastos, pagosEgresos, proyectos, clientes, crm_pipeline, crm_reviews.",
        prompt: `Business context JSON:\n${context}\n\nReturn max 6 concise insights, prioritized.`,
      });
      const items = (output as any)?.insights || [];
      // Replace previous non-dismissed insights for a clean view
      await admin.from("planner_insights").delete().eq("user_id", userId).eq("dismissed", false);
      if (items.length) {
        await admin.from("planner_insights").insert(items.map((it: any) => ({ ...it, user_id: userId })));
      }
      return json({ ok: true, insights: items });
    }

    // Briefing (morning / evening)
    const briefingKind = kind === "evening" ? "evening" : "morning";
    const sys = briefingKind === "morning"
      ? "You are Ferova's morning briefing. Spanish. Return the day's top priorities, meetings, deadlines, risks, and suggested focus block."
      : "You are Ferova's evening review. Spanish. Summarize what got done vs what didn't, main delays, productivity score (0-100), and a concrete suggestion for tomorrow's first block.";
    const { output } = await generateText({
      model: gateway("google/gemini-3.5-flash"),
      output: Output.object({ schema: BriefingSchema }),
      system: sys,
      prompt: `Context:\n${context}\n\nDate: ${new Date().toISOString().slice(0, 10)}`,
    });
    const payload = output as any;
    const date = new Date().toISOString().slice(0, 10);
    await admin.from("planner_briefings").upsert({ user_id: userId, kind: briefingKind, briefing_date: date, payload }, { onConflict: "user_id,kind,briefing_date" });
    return json({ ok: true, briefing: payload });
  } catch (err) {
    console.error("[planner-insights] error", err);
    return json({ ok: false, message: err instanceof Error ? err.message : String(err) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
