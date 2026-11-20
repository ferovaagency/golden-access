// Cobro con Whop: modelo de estados del navegador, cliente de la API (firma de
// webhooks, mapeo de planes, enlaces seguros) y los dos handlers reales de las
// edge functions (whop-webhook y whop-manage-subscription), ejecutados con una
// base de datos en memoria y una API de Whop simulada.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHmac } from "node:crypto";
import { transformSync } from "esbuild";
import { billingMessage, safePortalUrl, type BillingStatus } from "../src/lib/billingModel";
import { captureAffiliateFromUrl, readCheckoutReturn } from "../src/lib/whop";

// ---------------------------------------------------------------------------
// 1. Mensajes y enlaces del navegador
// ---------------------------------------------------------------------------
const base: BillingStatus = { status: "active", next_billed_at: "2026-12-19T12:00:00Z", current_period_ends_at: "2026-12-19T12:00:00Z", cancel_at: null, canceled_at: null, can_manage: true };
assert.equal(billingMessage(base).cancelable, true);
assert.equal(billingMessage({ ...base, cancel_at: base.next_billed_at }).title, "Renovación cancelada");
assert.equal(billingMessage({ ...base, cancel_at: base.next_billed_at }).cancelable, false);
assert.match(billingMessage({ ...base, status: "canceled" }).description, /plan Gratis/);
assert.match(billingMessage({ ...base, status: "none" }).title, /Sin suscripción/);
assert.match(billingMessage({ ...base, status: "past_due" }).description, /pendientes/);
assert.equal(safePortalUrl("https://whop.com/billing/manage/mber_1"), "https://whop.com/billing/manage/mber_1");
assert.equal(safePortalUrl("https://sandbox.whop.com/billing/manage/mber_1"), "https://sandbox.whop.com/billing/manage/mber_1");
for (const bad of ["javascript:alert(1)", "http://whop.com/x", "https://whop.com.evil.test/", "https://evilwhop.com/", "https://user:pw@whop.com/", "https://whop.com:8443/"]) {
  assert.throws(() => safePortalUrl(bad), undefined, bad);
}
assert.equal(readCheckoutReturn("?checkout=whop&status=succeeded&payment=pay_1"), "succeeded");
assert.equal(readCheckoutReturn("?checkout=whop&status=failed"), "failed");
assert.equal(readCheckoutReturn("?checkout=whop"), "pending");
assert.equal(readCheckoutReturn("?status=succeeded"), null);

// Afiliados: sin localStorage (Node) no rompe y valida el formato.
assert.equal(captureAffiliateFromUrl("?a=mafe_ventas"), "mafe_ventas");
assert.equal(captureAffiliateFromUrl("?a=<script>"), null);
assert.equal(captureAffiliateFromUrl(""), null);

// ---------------------------------------------------------------------------
// 2. Cliente de la API de Whop (se compila el archivo real con un Deno simulado)
// ---------------------------------------------------------------------------
const ENV: Record<string, string> = {
  SUPABASE_URL: "https://example.test",
  SUPABASE_ANON_KEY: "anon",
  SUPABASE_SERVICE_ROLE_KEY: "service",
  WHOP_API_KEY: "apik_test",
  WHOP_WEBHOOK_SECRET: "ws_dGVzdHNlY3JldA==",
  WHOP_PLAN_MEDIO_MENSUAL: "plan_medio_m",
  WHOP_PLAN_MEDIO_ANUAL: "plan_medio_a",
  WHOP_PLAN_PRO_MENSUAL: "plan_pro_m",
  WHOP_PLAN_PRO_ANUAL: "plan_pro_a",
};

type ApiCall = { method: string; url: string; body: any };
let apiCalls: ApiCall[] = [];
let memberships: Record<string, any> = {};
const fakeFetch = async (url: string, init: any) => {
  const body = init?.body ? JSON.parse(init.body) : undefined;
  apiCalls.push({ method: init?.method, url, body });
  const match = url.match(/\/memberships\/([^/]+)(\/cancel)?$/);
  if (!match) return new Response(JSON.stringify({ error: { message: "not found" } }), { status: 404 });
  const id = decodeURIComponent(match[1]);
  const m = memberships[id];
  if (!m) return new Response(JSON.stringify({ error: { message: "membership not found" } }), { status: 404 });
  if (match[2]) Object.assign(m, body?.cancel_at_period_end ? { cancel_at_period_end: true } : { status: "canceled" });
  else if (init?.method === "PATCH") Object.assign(m, body);
  return new Response(JSON.stringify(m), { status: 200 });
};

function compileModule(path: string): string {
  const source = readFileSync(path, "utf8").replace(/^import[\s\S]*?from\s+["'][^"']+["'];?\r?\n/gm, "");
  return transformSync(source, { loader: "ts", format: "cjs", target: "es2022" }).code;
}

const denoEnv = { get: (k: string) => ENV[k] };
const whopModule: { exports: Record<string, any> } = { exports: {} };
new Function("Deno", "fetch", "module", "exports", compileModule("supabase/functions/_shared/whop-api.ts"))({ env: denoEnv }, fakeFetch, whopModule, whopModule.exports);
const whopApi = whopModule.exports;

assert.deepEqual(whopApi.ferovaPlanFor("plan_pro_a"), { plan: "pro", periodo: "anual" });
assert.equal(whopApi.ferovaPlanFor("plan_otro_producto"), null);
assert.equal(whopApi.ferovaPlanFor(null), null);
assert.equal(whopApi.safeManageUrl("https://whop.com/billing/manage/mber_1"), "https://whop.com/billing/manage/mber_1");
assert.equal(whopApi.safeManageUrl("https://whop.com.evil.test/"), null);

function sign(body: string, secret: string, opts: { id?: string; ts?: number; decode?: boolean } = {}) {
  const id = opts.id ?? `msg_${Math.random().toString(36).slice(2)}`;
  const ts = String(opts.ts ?? Math.floor(Date.now() / 1000));
  const key = opts.decode ? Buffer.from(secret.replace(/^ws_/, ""), "base64") : Buffer.from(secret, "utf8");
  const signature = createHmac("sha256", key).update(`${id}.${ts}.${body}`).digest("base64");
  return new Headers({ "webhook-id": id, "webhook-timestamp": ts, "webhook-signature": `v1,${signature}`, "content-type": "application/json" });
}

// ---------------------------------------------------------------------------
// 3. Base de datos en memoria con la forma del cliente de supabase-js
// ---------------------------------------------------------------------------
type Row = Record<string, any>;
interface Db { user_subscriptions: Row[]; billing_webhook_events: Row[]; users: Record<string, { id: string; email: string }>; failUpsert?: boolean; failSelect?: boolean }

// Contador global: cada petición crea su propio cliente, pero los ids de fila
// deben ser únicos en toda la base simulada.
let seq = 1;
function makeAdmin(db: Db) {
  class Query {
    private filters: Array<(r: Row) => boolean> = [];
    private op: "select" | "update" | "delete" = "select";
    private patch: Row = {};
    constructor(private table: "user_subscriptions" | "billing_webhook_events") {}
    select() { return this; }
    order() { return this; }
    limit() { return this; }
    eq(k: string, v: unknown) { this.filters.push((r) => r[k] === v); return this; }
    neq(k: string, v: unknown) { this.filters.push((r) => r[k] !== v); return this; }
    update(patch: Row) { this.op = "update"; this.patch = patch; return this; }
    delete() { this.op = "delete"; return this; }
    insert(row: Row) {
      const rows = db[this.table];
      if (this.table === "billing_webhook_events" && rows.some((r) => r.provider === row.provider && r.event_id === row.event_id)) {
        return Promise.resolve({ error: { code: "23505", message: "duplicate" } });
      }
      rows.push({ id: seq++, outcome: "received", ...row });
      return Promise.resolve({ error: null });
    }
    upsert(row: Row) {
      if (db.failUpsert) return Promise.resolve({ error: { message: "db down" } });
      const rows = db.user_subscriptions;
      const found = rows.find((r) => r.provider === row.provider && r.provider_order_id === row.provider_order_id);
      if (found) Object.assign(found, row);
      else rows.push({ id: `sub_${seq++}`, created_at: new Date(Date.now() + seq).toISOString(), ...row });
      return Promise.resolve({ error: null });
    }
    private run() {
      const rows = db[this.table];
      const hit = rows.filter((r) => this.filters.every((f) => f(r)));
      if (this.op === "update") { hit.forEach((r) => Object.assign(r, this.patch)); return { data: null, error: null }; }
      if (this.op === "delete") { db[this.table] = rows.filter((r) => !hit.includes(r)); return { data: null, error: null }; }
      if (db.failSelect) return { data: null, error: { message: "db down" } };
      return { data: [...hit].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))), error: null };
    }
    maybeSingle() { const { data, error } = this.run(); return Promise.resolve({ data: (data as Row[] | null)?.[0] ?? null, error }); }
    then(resolve: (v: unknown) => void, reject: (e: unknown) => void) { try { resolve(this.run()); } catch (e) { reject(e); } }
  }
  return {
    from: (table: "user_subscriptions" | "billing_webhook_events") => new Query(table),
    rpc: async (_name: string, args: { p_email: string }) => ({ data: Object.values(db.users).find((u) => u.email === args.p_email.toLowerCase())?.id ?? null, error: null }),
    auth: { admin: { getUserById: async (id: string) => ({ data: { user: db.users[id] ?? null }, error: null }) } },
  };
}

function loadHandler(path: string, db: Db, authUserId: string | null, injected: Record<string, unknown>) {
  let handler: (r: Request) => Promise<Response> = null!;
  const createClient = (_url: string, key: string) =>
    key === "anon"
      ? { auth: { getUser: async () => ({ data: { user: authUserId ? { id: authUserId } : null }, error: null }) } }
      : makeAdmin(db);
  const names = ["Deno", "createClient", "corsHeaders", ...Object.keys(injected)];
  new Function(...names, compileModule(path))({ env: denoEnv, serve: (fn: typeof handler) => { handler = fn; } }, createClient, {}, ...Object.values(injected));
  return handler;
}

const OWNER = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
function freshDb(): Db {
  return { user_subscriptions: [], billing_webhook_events: [], users: { [OWNER]: { id: OWNER, email: "duena@ejemplo.test" }, [OTHER]: { id: OTHER, email: "otra@ejemplo.test" } } };
}
const future = new Date(Date.now() + 30 * 86_400_000).toISOString();

async function main() {
  // --- Firma ---------------------------------------------------------------
  const body = JSON.stringify({ type: "payment.failed", data: {} });
  assert.equal(await whopApi.verifyWhopWebhook(sign(body, ENV.WHOP_WEBHOOK_SECRET), body, ENV.WHOP_WEBHOOK_SECRET), true, "clave literal");
  assert.equal(await whopApi.verifyWhopWebhook(sign(body, ENV.WHOP_WEBHOOK_SECRET, { decode: true }), body, ENV.WHOP_WEBHOOK_SECRET), true, "clave base64 (Standard Webhooks)");
  assert.equal(await whopApi.verifyWhopWebhook(sign(body, "ws_otro"), body, ENV.WHOP_WEBHOOK_SECRET), false, "otro secreto");
  assert.equal(await whopApi.verifyWhopWebhook(sign(body, ENV.WHOP_WEBHOOK_SECRET), body + " ", ENV.WHOP_WEBHOOK_SECRET), false, "cuerpo alterado");
  assert.equal(await whopApi.verifyWhopWebhook(sign(body, ENV.WHOP_WEBHOOK_SECRET, { ts: Math.floor(Date.now() / 1000) - 3600 }), body, ENV.WHOP_WEBHOOK_SECRET), false, "fuera de la ventana de 5 min");

  // --- Webhook ---------------------------------------------------------------
  const webhookDeps = { cancelMembership: whopApi.cancelMembership, ferovaPlanFor: whopApi.ferovaPlanFor, getMembership: whopApi.getMembership, verifyWhopWebhook: whopApi.verifyWhopWebhook, whopConfigured: whopApi.whopConfigured, WhopError: whopApi.WhopError };
  const db = freshDb();
  const webhook = loadHandler("supabase/functions/whop-webhook/index.ts", db, null, webhookDeps);
  const deliver = async (event: unknown, opts: { secret?: string; id?: string } = {}) => {
    const raw = JSON.stringify(event);
    const res = await webhook(new Request("https://example.test/whop-webhook", { method: "POST", headers: sign(raw, opts.secret ?? ENV.WHOP_WEBHOOK_SECRET, { id: opts.id }), body: raw }));
    return { status: res.status, data: await res.json() };
  };

  // Firma inválida: no toca la base.
  let r = await deliver({ type: "payment.succeeded", data: {} }, { secret: "ws_falso" });
  assert.equal(r.status, 401);
  assert.equal(db.billing_webhook_events.length, 0);

  // Compra desde el checkout embebido: metadata.supabase_user_id identifica a la dueña.
  memberships = { mem_a: { id: "mem_a", status: "active", variant_id: "plan_medio_m", member_id: "mber_1", current_period_end: future, cancel_at_period_end: false } };
  apiCalls = [];
  r = await deliver({ id: "msg_1", type: "payment.succeeded", data: { id: "pay_1", membership_id: "mem_a", metadata: { supabase_user_id: OWNER }, usd_total: { amount: "20.00", currency: "usd" } } }, { id: "msg_1" });
  assert.equal(r.status, 200);
  assert.deepEqual(r.data, { ok: true, status: "active", plan: "medio", periodo: "mensual" });
  assert.equal(db.user_subscriptions.length, 1);
  assert.equal(db.user_subscriptions[0].user_id, OWNER);
  assert.equal(db.user_subscriptions[0].plan, "medio");
  assert.equal(db.user_subscriptions[0].amount_usd, 20);
  assert.equal(db.user_subscriptions[0].expires_at, null);
  assert.equal(db.billing_webhook_events[0].outcome, "processed");
  assert.ok(apiCalls.some((c) => c.method === "GET" && c.url.endsWith("/memberships/mem_a")), "consulta la membresía real");

  // Entrega repetida: idempotente.
  r = await deliver({ id: "msg_1", type: "payment.succeeded", data: { membership_id: "mem_a", metadata: { supabase_user_id: OWNER } } }, { id: "msg_1" });
  assert.deepEqual(r.data, { ok: true, duplicate: true });
  assert.equal(db.user_subscriptions.length, 1);

  // Cambio a Pro: membresía nueva activa → la anterior se cancela en Whop y aquí.
  memberships.mem_b = { id: "mem_b", status: "active", variant_id: "plan_pro_a", member_id: "mber_1", current_period_end: future };
  apiCalls = [];
  r = await deliver({ type: "payment.succeeded", data: { membership_id: "mem_b", metadata: { supabase_user_id: OWNER } } });
  assert.deepEqual(r.data, { ok: true, status: "active", plan: "pro", periodo: "anual" });
  assert.equal(db.user_subscriptions.find((s) => s.provider_order_id === "mem_a")!.status, "cancelled");
  assert.equal(db.user_subscriptions.find((s) => s.provider_order_id === "mem_b")!.status, "active");
  assert.ok(apiCalls.some((c) => c.method === "POST" && c.url.endsWith("/memberships/mem_a/cancel") && !c.body?.cancel_at_period_end), "cancela la anterior de inmediato");

  // Cancelación programada (membership.updated): sigue activa hasta el fin del período.
  memberships.mem_b.cancel_at_period_end = true;
  r = await deliver({ type: "membership.updated", data: { ...memberships.mem_b } });
  const rowB = db.user_subscriptions.find((s) => s.provider_order_id === "mem_b")!;
  assert.equal(rowB.status, "active");
  assert.equal(rowB.expires_at, future);

  // Fin efectivo: cancelled.
  memberships.mem_b.status = "canceled";
  r = await deliver({ type: "membership.updated", data: { ...memberships.mem_b } });
  assert.equal(db.user_subscriptions.find((s) => s.provider_order_id === "mem_b")!.status, "cancelled");

  // Compra en whop.com (enlace de afiliado) sin metadatos: se identifica por correo.
  memberships.mem_c = { id: "mem_c", status: "trialing", variant_id: "plan_medio_a", current_period_end: future };
  r = await deliver({ type: "payment.succeeded", data: { membership_id: "mem_c", customer_email: "otra@ejemplo.test", metadata: {} } });
  const rowC = db.user_subscriptions.find((s) => s.provider_order_id === "mem_c")!;
  assert.equal(rowC.user_id, OTHER);
  assert.equal(rowC.trial_ends_at, future, "la prueba de Whop se refleja en trial_ends_at");

  // Correo sin cuenta en Ferova: queda 'unmatched', sin fila.
  memberships.mem_d = { id: "mem_d", status: "active", variant_id: "plan_pro_m", current_period_end: future };
  r = await deliver({ id: "msg_d", type: "payment.succeeded", data: { membership_id: "mem_d", customer_email: "nadie@ejemplo.test" } }, { id: "msg_d" });
  assert.deepEqual(r.data, { ok: true, unmatched: true });
  assert.equal(db.user_subscriptions.some((s) => s.provider_order_id === "mem_d"), false);
  assert.equal(db.billing_webhook_events.find((e) => e.event_id === "msg_d")!.outcome, "unmatched");

  // Metadata con un id que no existe: no se le da acceso a nadie.
  memberships.mem_e = { id: "mem_e", status: "active", variant_id: "plan_pro_m", current_period_end: future };
  r = await deliver({ type: "payment.succeeded", data: { membership_id: "mem_e", metadata: { supabase_user_id: "33333333-3333-4333-8333-333333333333" } } });
  assert.deepEqual(r.data, { ok: true, unmatched: true });

  // Producto de Whop que no es Ferova One: ignorado.
  memberships.mem_f = { id: "mem_f", status: "active", variant_id: "plan_otro_producto" };
  r = await deliver({ type: "payment.succeeded", data: { membership_id: "mem_f", metadata: { supabase_user_id: OWNER } } });
  assert.equal(r.data.ignored, true);

  // Evento no manejado: ignorado.
  r = await deliver({ type: "dispute.created", data: {} });
  assert.equal(r.data.ignored, true);

  // Falla al guardar: 500 y se borra el registro del evento para que Whop reintente.
  const dbFail = freshDb();
  dbFail.failUpsert = true;
  const webhookFail = loadHandler("supabase/functions/whop-webhook/index.ts", dbFail, null, webhookDeps);
  memberships.mem_g = { id: "mem_g", status: "active", variant_id: "plan_medio_m", current_period_end: future };
  const rawG = JSON.stringify({ type: "payment.succeeded", data: { membership_id: "mem_g", metadata: { supabase_user_id: OWNER } } });
  const resG = await webhookFail(new Request("https://example.test/whop-webhook", { method: "POST", headers: sign(rawG, ENV.WHOP_WEBHOOK_SECRET, { id: "msg_g" }), body: rawG }));
  assert.equal(resG.status, 500);
  assert.equal(dbFail.billing_webhook_events.length, 0, "permite el reintento");

  // --- Gestión de la suscripción --------------------------------------------
  const manageDeps = { getMembership: whopApi.getMembership, resumeMembership: whopApi.resumeMembership, safeManageUrl: whopApi.safeManageUrl, whopConfigured: whopApi.whopConfigured, WhopError: whopApi.WhopError };
  const call = async (handlerDb: Db, user: string | null, payload: Record<string, unknown>) => {
    const handler = loadHandler("supabase/functions/whop-manage-subscription/index.ts", handlerDb, user, manageDeps);
    const res = await handler(new Request("https://example.test/fn", { method: "POST", headers: { Authorization: "Bearer t", "Content-Type": "application/json" }, body: JSON.stringify(payload) }));
    return { status: res.status, data: await res.json(), headers: res.headers };
  };
  const mdb = freshDb();
  mdb.user_subscriptions.push({ id: "s1", user_id: OWNER, provider: "whop", provider_order_id: "mem_m", status: "active", created_at: "2026-11-19T10:00:00Z" });
  memberships.mem_m = { id: "mem_m", status: "active", current_period_end: future, cancel_at_period_end: false, manage_url: "https://whop.com/billing/manage/mber_9" };

  let m = await call(mdb, null, { action: "status" });
  assert.equal(m.status, 401);
  m = await call(mdb, OWNER, { action: "borrar" });
  assert.equal(m.status, 400);
  m = await call(mdb, OWNER, { action: "status" });
  assert.equal(m.data.status, "active");
  assert.equal(m.data.next_billed_at, future);
  assert.equal(m.data.can_manage, true);
  assert.equal(m.headers.get("Cache-Control"), "no-store");
  // Otra cuenta no ve la membresía de la dueña, aunque mande su id.
  m = await call(mdb, OTHER, { action: "portal", membership_id: "mem_m" });
  assert.equal(m.status, 409);
  m = await call(mdb, OWNER, { action: "portal" });
  assert.equal(m.data.url, "https://whop.com/billing/manage/mber_9");
  memberships.mem_m.manage_url = "https://evil.test/";
  m = await call(mdb, OWNER, { action: "portal" });
  assert.equal(m.status, 502, "enlace ajeno a whop.com rechazado");
  memberships.mem_m.cancel_at_period_end = true;
  m = await call(mdb, OWNER, { action: "status" });
  assert.equal(m.data.cancel_at, future);
  assert.equal(m.data.next_billed_at, null);
  m = await call(mdb, OWNER, { action: "resume" });
  assert.equal(m.data.cancel_at, null);
  assert.equal(memberships.mem_m.cancel_at_period_end, false);
  m = await call(freshDb(), OWNER, { action: "status" });
  assert.equal(m.data.status, "none");
  const broken = freshDb();
  broken.failSelect = true;
  m = await call(broken, OWNER, { action: "status" });
  assert.equal(m.status, 500);

  console.log("Whop: firma, activación, cambio de plan, cancelación, compras sin cuenta, idempotencia y portal verificados.");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
