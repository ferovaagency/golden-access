// Cliente mínimo de la API de Paddle Billing para el servidor. La API key
// vive sólo aquí (secreto PADDLE_API_KEY); al navegador sólo viaja el
// client-side token. PADDLE_ENV=sandbox apunta al entorno de pruebas.

const API_KEY = Deno.env.get("PADDLE_API_KEY") || "";
const BASE = (Deno.env.get("PADDLE_ENV") || "production") === "sandbox" ? "https://sandbox-api.paddle.com" : "https://api.paddle.com";

export function paddleConfigured(): boolean {
  return !!API_KEY;
}

export class PaddleError extends Error {
  readonly status: number;
  readonly code: string | null;
  constructor(status: number, message: string, code: string | null) {
    super(message);
    this.name = "PaddleError";
    this.status = status;
    this.code = code;
  }
}

export async function paddle<T = any>(method: "GET" | "POST" | "PATCH", path: string, body?: unknown): Promise<T> {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${API_KEY}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = payload?.error?.detail || payload?.error?.message || `Paddle respondió ${response.status}`;
    throw new PaddleError(response.status, detail, payload?.error?.code ?? null);
  }
  return payload?.data as T;
}

/** Busca un cliente por correo o lo crea. */
export async function ensureCustomer(email: string, name?: string | null): Promise<string> {
  const found = await paddle<Array<{ id: string }>>("GET", `/customers?email=${encodeURIComponent(email)}&status=active`);
  if (Array.isArray(found) && found[0]?.id) return found[0].id;
  const created = await paddle<{ id: string }>("POST", "/customers", { email, name: name || undefined });
  return created.id;
}

/** Devuelve una dirección activa del cliente o crea una con el país dado. */
export async function ensureAddress(customerId: string, countryCode: string): Promise<string> {
  const found = await paddle<Array<{ id: string; country_code: string }>>("GET", `/customers/${customerId}/addresses?status=active`);
  const same = (found || []).find((a) => a.country_code === countryCode) || (found || [])[0];
  if (same?.id) return same.id;
  const created = await paddle<{ id: string }>("POST", `/customers/${customerId}/addresses`, { country_code: countryCode });
  return created.id;
}

// Correos desechables más comunes: sin CAPTCHA, es la barrera mínima contra
// pruebas en serie. Lista corta a propósito; se amplía si hace falta.
const DISPOSABLE = new Set(["mailinator.com", "guerrillamail.com", "10minutemail.com", "tempmail.com", "temp-mail.org", "yopmail.com", "trashmail.com", "getnada.com", "dispostable.com", "sharklasers.com", "maildrop.cc", "fakeinbox.com", "throwawaymail.com", "mohmal.com", "emailondeck.com"]);

export function isDisposableEmail(email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase() || "";
  return DISPOSABLE.has(domain);
}

// Mismos prices que src/lib/paddle.ts (DEFAULT_PRICE_IDS). Se pueden
// sobreescribir por secreto (PADDLE_PRICE_BASICO_MENSUAL, …) para sandbox.
const DEFAULT_PRICES: Record<string, Record<string, string>> = {
  basico: { mensual: "pri_01m4emwxhze2x9xbrhyt2b9jsa", anual: "pri_01m4emyb3ejg4csdgam8sfv9nf" },
  intermedio: { mensual: "pri_01m4emz1pamrfk6mn865hf65xs", anual: "pri_01m4emzvw6h9sdw0m0gfmr8yw9" },
  full: { mensual: "pri_01m4en0g7kc57ye7px0xen5ywg", anual: "pri_01m4en1ffgx5xygv6yppdk9pfp" },
};

export function priceIdFor(plan: string, periodo: string): string {
  const env = Deno.env.get(`PADDLE_PRICE_${plan.toUpperCase()}_${periodo.toUpperCase()}`);
  return env?.trim() || DEFAULT_PRICES[plan]?.[periodo] || "";
}

