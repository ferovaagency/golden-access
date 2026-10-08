import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

// Plan de una cuenta, resuelto en el servidor con la misma regla que el
// navegador (src/lib/supabase.ts → resolveAccess): suscripción activa y no
// vencida → su plan; cortesía por correo → su plan; nada → Gratis.
// Y los topes de uso que el servidor debe hacer cumplir (la IA se controla
// aquí porque ai_usage_log no es legible desde el navegador).

export type ServerPlan = "free" | "basico" | "intermedio" | "full" | "legacy";

const LEGACY = new Set(["projects", "finance", "planner", "crm", "completo", "custom", "financiero", "crm_ventas"]);

export async function resolvePlanForAccount(
  admin: SupabaseClient<any, "public", "public", any, any>,
  accountId: string,
  email: string,
): Promise<ServerPlan> {
  const { data: sub } = await admin
    .from("user_subscriptions")
    .select("status, expires_at, plan")
    .eq("user_id", accountId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (sub && (!sub.expires_at || new Date(sub.expires_at) >= new Date())) return normalize(sub.plan);
  if (email) {
    const { data: courtesy } = await admin.from("courtesy_access_grants").select("plan").eq("email", email).maybeSingle();
    if (courtesy) return normalize(courtesy.plan ?? "full");
  }
  return "free";
}

function normalize(plan: unknown): ServerPlan {
  if (plan === "free" || plan === "basico" || plan === "intermedio" || plan === "full") return plan;
  if (typeof plan === "string" && LEGACY.has(plan)) return "legacy";
  return "full";
}

/** Consultas al asistente por mes. null = sin tope. Debe coincidir con PLAN_LIMITS en src/lib/planService.ts. */
export function aiMonthlyLimit(plan: ServerPlan): number | null {
  if (plan === "free") return 10;
  if (plan === "basico") return 100;
  return null;
}

export async function countAiQueriesThisMonth(
  admin: SupabaseClient<any, "public", "public", any, any>,
  userId: string,
  funcion = "business-assistant-chat",
): Promise<number> {
  const now = new Date();
  const since = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const { count } = await admin
    .from("ai_usage_log")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("funcion", funcion)
    .gte("created_at", since);
  return count || 0;
}
