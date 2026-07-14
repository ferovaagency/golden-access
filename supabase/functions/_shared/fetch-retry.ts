// Reintenta un fetch con backoff exponencial ante errores transitorios (429, 5xx,
// o fallos de red). Deliberadamente NO se adopta una librería como `ky` para esto:
// el proyecto usa fetch nativo de forma consistente en todas las Edge Functions, y
// este helper de ~20 líneas cubre lo que necesitamos sin agregar una dependencia
// nueva a cada función.
export interface FetchRetryOptions {
  retries?: number; // intentos adicionales tras el primero (default 2 => 3 intentos en total)
  baseDelayMs?: number; // delay del primer reintento, se duplica en cada intento siguiente
  retryOn?: (res: Response | null, err: unknown) => boolean;
}

const DEFAULT_RETRY_ON = (res: Response | null, err: unknown) => {
  if (err) return true; // error de red (timeout, DNS, conexión reseteada, etc.)
  if (!res) return true;
  return res.status === 429 || res.status >= 500;
};

export async function fetchWithRetry(
  input: string | URL,
  init?: RequestInit,
  options: FetchRetryOptions = {},
): Promise<Response> {
  const retries = options.retries ?? 2;
  const baseDelayMs = options.baseDelayMs ?? 400;
  const retryOn = options.retryOn ?? DEFAULT_RETRY_ON;

  let lastErr: unknown = null;
  let lastRes: Response | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(input, init);
      if (!retryOn(res, null) || attempt === retries) return res;
      lastRes = res;
    } catch (err) {
      lastErr = err;
      if (attempt === retries) throw err;
    }
    await new Promise((resolve) => setTimeout(resolve, baseDelayMs * 2 ** attempt));
  }

  // Solo se llega aquí si todos los intentos devolvieron una respuesta "retryable"
  // (429/5xx) sin nunca lanzar una excepción de red -- retornamos la última respuesta
  // para que el llamador decida cómo manejar el error HTTP.
  if (lastRes) return lastRes;
  throw lastErr;
}
