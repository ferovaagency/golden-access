// Instrumentación de costo de IA (Fase 4, plan de lanzamiento).
// Registra tokens por llamada al modelo, sin bloquear ni afectar la respuesta al
// usuario. El objetivo es saber el costo real por conversación y por usuario
// (percentil 95, no promedio) antes de fijar precio. Guardamos tokens crudos y
// el modelo; el costo en dinero se deriva después con las tarifas de cada modelo.

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

/**
 * Cliente para registrar el uso. `ai_usage_log` tiene RLS y ninguna política:
 * sólo service_role escribe ahí. Varias funciones sólo tienen el cliente del
 * usuario (clave anon), y con ese el registro fallaría en silencio — de ahí
 * este atajo.
 */
export function usageClient(): SupabaseClient {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

/**
 * Suma los `usage` de varias llamadas al modelo para dejar UNA fila por
 * invocación. `planner-classify` puede hacer 20 llamadas seguidas: 20 filas
 * dirían lo mismo y ensuciarían el percentil por invocación.
 */
export function sumUsage(usages: Array<AnyUsage | null | undefined>): AnyUsage | null {
  let input = 0, output = 0, cached = 0, total = 0, vistas = 0;
  for (const u of usages) {
    if (!u) continue;
    vistas++;
    input  += pickNumber(u.inputTokens, u.promptTokens, u.prompt_tokens) ?? 0;
    output += pickNumber(u.outputTokens, u.completionTokens, u.completion_tokens) ?? 0;
    cached += pickNumber(u.cachedInputTokens, u.cached_input_tokens, u.prompt_tokens_details?.cached_tokens) ?? 0;
    total  += pickNumber(u.totalTokens, u.total_tokens) ?? 0;
  }
  if (!vistas) return null;
  return {
    inputTokens: input,
    outputTokens: output,
    cachedInputTokens: cached,
    totalTokens: total || input + output,
  };
}

// La forma de `usage` cambió entre versiones del AI SDK (promptTokens vs
// inputTokens, etc.). Leemos defensivamente para no depender de una versión.
interface AnyUsage {
  inputTokens?: number; outputTokens?: number; totalTokens?: number;
  promptTokens?: number; completionTokens?: number;
  cachedInputTokens?: number; cached_input_tokens?: number;
  // Formato OpenAI/gateway crudo (respuestas por fetch directo): snake_case.
  prompt_tokens?: number; completion_tokens?: number; total_tokens?: number;
  prompt_tokens_details?: { cached_tokens?: number };
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
    const input = pickNumber(usage.inputTokens, usage.promptTokens, usage.prompt_tokens);
    const output = pickNumber(usage.outputTokens, usage.completionTokens, usage.completion_tokens);
    const cached = pickNumber(usage.cachedInputTokens, usage.cached_input_tokens, usage.prompt_tokens_details?.cached_tokens);
    const total = pickNumber(usage.totalTokens, usage.total_tokens) ?? ((input ?? 0) + (output ?? 0) || null);
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
