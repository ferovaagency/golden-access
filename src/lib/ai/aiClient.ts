// Centralized browser-side AI entrypoint. All React modules must go through
// this file — never call edge functions or AI providers directly from
// components. This is the seam where we will later plug memory, tool
// dispatching, caching, and rate limiting.
//
// Server-side (edge functions) has its own gateway helper in
// supabase/functions/_shared/ai-gateway.ts. Keep them aligned.

import { getSupabaseFunctionUrl, supabase } from '../../integrations/supabase/client';
import { logger } from '../logger';

const log = logger.child('ai');

export interface AiInvokeOptions {
  // Which edge function to invoke. Every AI feature ships as an edge function
  // so prompts, tools and LOVABLE_API_KEY stay server-side.
  functionName: string;
  body?: Record<string, unknown>;
  // Optional signal for aborting long-running calls (chat streams should use
  // the SDK directly with its own transport).
  signal?: AbortSignal;
}

export interface AiInvokeResult<T = unknown> {
  data: T | null;
  error: Error | null;
}

export async function invokeAi<T = unknown>(opts: AiInvokeOptions): Promise<AiInvokeResult<T>> {
  const { functionName, body, signal } = opts;
  try {
    log.debug('invoke', functionName);
    const { data: session } = await supabase.auth.getSession();
    const url = getSupabaseFunctionUrl(functionName);
    const res = await fetch(url, {
      method: 'POST',
      signal,
      headers: {
        'Content-Type': 'application/json',
        ...(session.session?.access_token
          ? { Authorization: `Bearer ${session.session.access_token}` }
          : {}),
      },
      body: JSON.stringify(body ?? {}),
    });
    const text = await res.text();
    const parsed = text ? safeJson(text) : null;
    if (!res.ok) {
      const message =
        (parsed && typeof parsed === 'object' && parsed !== null && 'message' in parsed
          ? String((parsed as { message: unknown }).message)
          : null) ?? `AI call failed (${res.status})`;
      return { data: null, error: new Error(message) };
    }
    return { data: (parsed as T) ?? null, error: null };
  } catch (err) {
    const normalized = err instanceof Error ? err : new Error(String(err));
    log.error(normalized, { functionName });
    return { data: null, error: normalized };
  }
}

function safeJson(text: string): unknown {
  try { return JSON.parse(text); } catch { return text; }
}
