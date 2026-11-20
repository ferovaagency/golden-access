// Cliente mínimo de la API de Whop para el servidor (nov 2026).
//
// Secretos (sólo en Supabase, nunca en el navegador):
//   WHOP_API_KEY            API key de la cuenta (dashboard → Developer). Necesita
//                           permiso para leer/gestionar membresías y pagos
//                           (incluido member:manage, para recibir `manage_url`).
//   WHOP_WEBHOOK_SECRET     secreto del webhook (ws_…), se muestra una sola vez.
//   WHOP_ENV=sandbox        opcional, para probar contra sandbox.whop.com.
//   WHOP_PLAN_MEDIO_MENSUAL, WHOP_PLAN_MEDIO_ANUAL,
//   WHOP_PLAN_PRO_MENSUAL,   WHOP_PLAN_PRO_ANUAL
//                           ids de los planes (plan_…) creados en Whop. Son los
//                           mismos que VITE_WHOP_PLAN_* del navegador.
//
// Docs: https://docs.whop.com/developer/guides/memberships ,
//       https://docs.whop.com/developer/guides/webhooks

const API_KEY = (Deno.env.get("WHOP_API_KEY") || "").trim().replace(/^Bearer\s+/i, "").replace(/["']/g, "").trim();
const SANDBOX = (Deno.env.get("WHOP_ENV") || "production").trim() === "sandbox";
const BASE = SANDBOX ? "https://sandbox-api.whop.com/api/v1" : "https://api.whop.com/api/v1";

export function whopConfigured(): boolean {
  return !!API_KEY;
}

export class WhopError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "WhopError";
    this.status = status;
  }
}

export async function whop<T = any>(method: "GET" | "POST" | "PATCH", path: string, body?: unknown): Promise<T> {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${API_KEY}`, "Content-Type": "application/json", Accept: "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = payload?.error?.message || payload?.message || `Whop respondió ${response.status}`;
    throw new WhopError(response.status, String(detail));
  }
  return payload as T;
}

/** Membresía de Whop: el vínculo vivo entre un comprador y un plan. */
export interface WhopMembership {
  id: string;
  status: "trialing" | "active" | "past_due" | "completed" | "canceled" | "expired" | "unresolved" | string;
  variant_id?: string | null;
  plan_id?: string | null;
  product_id?: string | null;
  user_id?: string | null;
  member_id?: string | null;
  metadata?: Record<string, unknown> | null;
  cancel_at_period_end?: boolean | null;
  canceled_at?: string | null;
  current_period_start?: string | null;
  current_period_end?: string | null;
  expires_at?: string | null;
  manage_url?: string | null;
}

export function getMembership(id: string): Promise<WhopMembership> {
  return whop<WhopMembership>("GET", `/memberships/${encodeURIComponent(id)}`);
}

/** Cancela una membresía. `atPeriodEnd=false` corta el acceso de inmediato. */
export function cancelMembership(id: string, atPeriodEnd: boolean): Promise<WhopMembership> {
  return whop<WhopMembership>("POST", `/memberships/${encodeURIComponent(id)}/cancel`, atPeriodEnd ? { cancel_at_period_end: true } : {});
}

/** Deshace una cancelación programada para fin de período. */
export function resumeMembership(id: string): Promise<WhopMembership> {
  return whop<WhopMembership>("PATCH", `/memberships/${encodeURIComponent(id)}`, { cancel_at_period_end: false });
}

// ---------------------------------------------------------------------------
// Planes de Whop ↔ planes de Ferova.
// ---------------------------------------------------------------------------
export type FerovaPlan = "medio" | "pro";
export type Periodo = "mensual" | "anual";

const COMBOS: Array<[FerovaPlan, Periodo]> = [["medio", "mensual"], ["medio", "anual"], ["pro", "mensual"], ["pro", "anual"]];

/** Plan y período de Ferova para un plan de Whop (plan_…), o null si no es uno nuestro. */
export function ferovaPlanFor(whopPlanId: string | null | undefined): { plan: FerovaPlan; periodo: Periodo } | null {
  if (!whopPlanId) return null;
  for (const [plan, periodo] of COMBOS) {
    const configured = (Deno.env.get(`WHOP_PLAN_${plan.toUpperCase()}_${periodo.toUpperCase()}`) || "").trim();
    if (configured && configured === whopPlanId) return { plan, periodo };
  }
  return null;
}

/** El enlace de administración que entrega Whop, sólo si es https y de whop.com. */
export function safeManageUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
    if (host !== "whop.com" && !host.endsWith(".whop.com")) return null;
    return url.href;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Firma de webhooks (Standard Webhooks): HMAC-SHA256 en base64 sobre
// `${webhook-id}.${webhook-timestamp}.${cuerpo crudo}`, cabecera
// `webhook-signature: v1,<base64> [v1,<base64> …]`. Whop documenta usar el
// secreto tal cual; el estándar decodifica en base64 lo que va después del
// prefijo. Se aceptan las dos claves (ambas salen del mismo secreto).
// ---------------------------------------------------------------------------
const MAX_SKEW_SECONDS = 5 * 60;

function candidateKeys(secret: string): Uint8Array[] {
  const keys: Uint8Array[] = [new TextEncoder().encode(secret)];
  const match = secret.match(/^(?:ws|whsec)_(.+)$/);
  if (match) {
    try {
      const bin = atob(match[1]);
      keys.push(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
    } catch { /* no es base64: sólo vale la clave literal */ }
  }
  return keys;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function verifyWhopWebhook(headers: Headers, rawBody: string, secret: string): Promise<boolean> {
  if (!secret) return false;
  const id = headers.get("webhook-id");
  const timestamp = headers.get("webhook-timestamp");
  const signatureHeader = headers.get("webhook-signature");
  if (!id || !timestamp || !signatureHeader) return false;
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > MAX_SKEW_SECONDS) return false;

  const provided = signatureHeader.split(" ").map((part) => part.trim()).filter((part) => part.startsWith("v1,")).map((part) => part.slice(3));
  if (!provided.length) return false;

  const message = new TextEncoder().encode(`${id}.${timestamp}.${rawBody}`);
  for (const keyBytes of candidateKeys(secret)) {
    const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const signed = new Uint8Array(await crypto.subtle.sign("HMAC", key, message));
    const expected = btoa(String.fromCharCode(...signed));
    if (provided.some((sig) => timingSafeEqual(sig, expected))) return true;
  }
  return false;
}
