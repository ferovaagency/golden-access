import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { transformSync } from "esbuild";
import { billingMessage, safePortalUrl, type BillingStatus } from "../src/lib/billingModel";
import {
  assertSubscriptionOwner,
  billingSummary,
  portalLink,
} from "../supabase/functions/_shared/subscription-portal";
const base: BillingStatus = {
  status: "active",
  next_billed_at: "2026-11-09T12:00:00Z",
  current_period_ends_at: "2026-11-09T12:00:00Z",
  cancel_at: null,
  canceled_at: null,
  can_manage: true,
};
assert.equal(billingMessage(base).cancelable, true);
assert.equal(billingMessage({ ...base, cancel_at: base.next_billed_at }).cancelable, false);
assert.equal(
  billingMessage({ ...base, cancel_at: base.next_billed_at }).title,
  "Renovación cancelada",
);
assert.equal(billingMessage({ ...base, status: "canceled" }).title, "Suscripción cancelada");
assert.equal(billingMessage({ ...base, status: "none" }).cancelable, false);
assert.match(billingMessage({ ...base, status: "trialing" }).description, /fecha efectiva/);
assert.match(billingMessage({ ...base, status: "past_due" }).description, /pendientes/);
for (const url of [
  "javascript:alert(1)",
  "https://customer-portal.paddle.com.evil.test/",
  "https://evil.test/",
  "http://customer-portal.paddle.com/",
  "https://a:b@customer-portal.paddle.com/",
  "https://customer-portal.paddle.com:444/",
])
  assert.throws(() => safePortalUrl(url));
assert.equal(
  safePortalUrl("https://sandbox-customer-portal.paddle.com/test?token=example"),
  "https://sandbox-customer-portal.paddle.com/test?token=example",
);
const sub = {
  id: "sub_owned",
  customer_id: "ctm_owned",
  status: "active",
  custom_data: { user_id: "owner" },
  current_billing_period: { ends_at: "2026-11-09T12:00:00Z" },
  scheduled_change: { action: "cancel", effective_at: "2026-11-09T12:00:00Z" },
};
assert.equal(
  billingSummary(sub).status,
  "active",
  "Scheduling cancellation must retain current access",
);
assert.equal(billingSummary(sub).cancel_at, sub.scheduled_change.effective_at);
assert.equal(
  billingSummary({ ...sub, scheduled_change: null }).cancel_at,
  null,
  "Undo must clear scheduled state",
);
assert.throws(() => assertSubscriptionOwner(sub, "attacker", "ctm_owned"));
assert.throws(() => assertSubscriptionOwner(sub, "owner", "ctm_other"));
assertSubscriptionOwner(sub, "owner", "ctm_owned");
const portal = {
  urls: {
    general: { overview: "https://customer-portal.paddle.com/overview?token=example" },
    subscriptions: [
      {
        id: "sub_owned",
        cancel_subscription: "https://customer-portal.paddle.com/cancel?token=example",
      },
    ],
  },
};
assert.equal(
  portalLink(portal, "cancel", "sub_owned"),
  portal.urls.subscriptions[0].cancel_subscription,
);
assert.throws(() => portalLink(portal, "cancel", "sub_other"));

// Execute the real Edge Function handler with injected auth, DB and Paddle transports.
const source = readFileSync(
  "supabase/functions/paddle-manage-subscription/index.ts",
  "utf8",
).replace(/^import[\s\S]*?from\s+["'][^"']+["'];?\r?\n/gm, "");
const compiled = transformSync(source, { loader: "ts", format: "cjs", target: "es2022" }).code;
async function run(
  options: {
    auth?: boolean;
    rows?: unknown[];
    dbError?: boolean;
    remote?: unknown;
    body?: Record<string, unknown>;
    apiError?: boolean;
  } = {},
) {
  const calls: Array<{ method: string; path: string; body?: unknown }> = [],
    filters: Array<[string, string]> = [];
  let writes = 0;
  let handler: (r: Request) => Promise<Response> = null!;
  const rows = options.rows ?? [
    {
      id: "row",
      status: "active",
      provider_order_id: "sub_owned",
      provider_customer_id: "ctm_owned",
      plan: "basico",
    },
  ];
  const query: any = {
    select() {
      return this;
    },
    eq(k: string, v: string) {
      filters.push([k, v]);
      return this;
    },
    order() {
      return this;
    },
    limit() {
      return Promise.resolve({
        data: rows,
        error: options.dbError ? { message: "db down" } : null,
      });
    },
    update() {
      writes++;
      return this;
    },
  };
  const createClient = (_url: string, key: string) =>
    key === "anon"
      ? {
          auth: {
            getUser: async () => ({
              data: { user: options.auth === false ? null : { id: "owner" } },
              error: null,
            }),
          },
        }
      : { from: () => query };
  const api = async (method: string, path: string, body: unknown) => {
    calls.push({ method, path, body });
    if (options.apiError) throw new Error("Proveedor no disponible");
    return method === "POST" ? portal : (options.remote ?? sub);
  };
  const deno = {
    env: {
      get: (k: string) =>
        k === "SUPABASE_ANON_KEY"
          ? "anon"
          : k === "SUPABASE_SERVICE_ROLE_KEY"
            ? "service"
            : "https://example.test",
    },
    serve: (fn: typeof handler) => {
      handler = fn;
    },
  };
  new Function(
    "Deno",
    "createClient",
    "corsHeaders",
    "paddle",
    "paddleConfigured",
    "PaddleError",
    "priceIdFor",
    "assertSubscriptionOwner",
    "billingSummary",
    "portalLink",
    compiled,
  )(
    deno,
    createClient,
    {},
    api,
    () => true,
    class extends Error {},
    () => "",
    assertSubscriptionOwner,
    billingSummary,
    portalLink,
  );
  const response = await handler(
    new Request("https://example.test/function", {
      method: "POST",
      headers: { Authorization: "Bearer test", "Content-Type": "application/json" },
      body: JSON.stringify(
        options.body ?? {
          action: "portal",
          intent: "cancel",
          user_id: "attacker",
          subscription_id: "sub_other",
          customer_id: "ctm_other",
        },
      ),
    }),
  );
  return {
    status: response.status,
    headers: response.headers,
    data: await response.json(),
    calls,
    filters,
    writes,
  };
}
async function main() {
  let result = await run();
  assert.equal(result.status, 200);
  assert.equal(result.data.url, portal.urls.subscriptions[0].cancel_subscription);
  assert.deepEqual(
    result.calls.map((c) => c.path),
    ["/subscriptions/sub_owned", "/customers/ctm_owned/portal-sessions"],
  );
  assert.deepEqual(result.calls[1].body, { subscription_ids: ["sub_owned"] });
  assert.ok(result.filters.some(([k, v]) => k === "user_id" && v === "owner"));
  assert.equal(result.writes, 0);
  assert.equal(result.headers.get("Cache-Control"), "no-store");
  result = await run({ auth: false });
  assert.equal(result.status, 401);
  assert.equal(result.calls.length, 0);
  result = await run({ dbError: true });
  assert.equal(result.status, 500);
  assert.equal(result.calls.length, 0);
  result = await run({ remote: { ...sub, customer_id: "ctm_other" } });
  assert.equal(result.status, 500);
  assert.equal(result.calls.length, 1);
  result = await run({ remote: { ...sub, custom_data: { user_id: "someone_else" } } });
  assert.equal(result.status, 500);
  assert.equal(result.calls.length, 1);
  result = await run({ body: { action: "portal", intent: "delete" } });
  assert.equal(result.status, 400);
  assert.equal(result.calls.length, 0);
  result = await run({ body: { action: "status" } });
  assert.equal(result.data.status, "active");
  assert.equal(result.data.cancel_at, sub.scheduled_change.effective_at);
  assert.equal(result.writes, 0);
  result = await run({ rows: [], body: { action: "status" } });
  assert.equal(result.data.status, "none");
  assert.equal(result.data.can_manage, false);
  result = await run({ rows: [] });
  assert.equal(result.status, 409);
  assert.equal(result.calls.length, 0);
  result = await run({ apiError: true });
  assert.equal(result.status, 500);
  assert.equal(result.data.ok, false);
  console.log(
    "Billing: state transitions, secure URLs, ownership, auth, self-service portal, no writes and provider failures verified.",
  );
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
