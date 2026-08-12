// Instrumentación de costo de IA (Fase 4, plan de lanzamiento).
// Registra tokens por llamada al modelo, sin bloquear ni afectar la respuesta al
// usuario. El objetivo es saber el costo real por conversación y por usuario
// (percentil 95, no promedio) antes de fijar precio. Guardamos tokens crudos y
// el modelo; el costo en dinero se deriva después con las tarifas de cada modelo.

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

// La forma de `usage` cambió entre versiones del AI SDK (promptTokens vs
// inputTokens, etc.). Leemos defensivamente para no depender de una versión.
interface AnyUsage {
  inputTokens?: number; outputTokens?: number; totalTokens?: number;
  promptTokens?: number; completionTokens?: number;
  cachedInputTokens?: number; cached_input_tokens?: number;
  [k: string]: unknown;
}

function pickNumber(...values: Array<unknown>): number | null {
  for (const v of values) if (typeof v === "number" && Number.isFinite(v)) return Math.round(v);
  return null;
}

/**
 * Registra el uso de tokens de una llamada al modelo. Es fire-and-forget:
 * nunca lanza hacia el llamador; cualquier fallo solo se loguea. Pasar la
 * promesa `result.usage` (streamText) o el `usage` ya resuelto (generateText).
 */
export async function logAiUsage(
  admin: SupabaseClient,
  params: { userId: string | null; funcion: string; modelo: string; usage: AnyUsage | Promise<AnyUsage> | null | undefined },
): Promise<void> {
  try {
    const usage = (params.usage && typeof (params.usage as Promise<AnyUsage>).then === "function"
      ? await (params.usage as Promise<AnyUsage>)
      : params.usage) as AnyUsage | null | undefined;
    if (!usage) return;
    const input = pickNumber(usage.inputTokens, usage.promptTokens);
    const output = pickNumber(usage.outputTokens, usage.completionTokens);
    const cached = pickNumber(usage.cachedInputTokens, usage.cached_input_tokens);
    const total = pickNumber(usage.totalTokens) ?? ((input ?? 0) + (output ?? 0) || null);
    await admin.from("ai_usage_log").insert({
      user_id: params.userId,
      funcion: params.funcion,
      modelo: params.modelo,
      input_tokens: input,
      output_tokens: output,
      cached_input_tokens: cached,
      total_tokens: total,
    });
  } catch (error) {
    console.error("[ai-usage] no se pudo registrar el uso", error);
  }
}
