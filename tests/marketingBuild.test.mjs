import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
import { resolve } from "node:path";

const dist = resolve("dist");
const origin = "https://one.ferova.com.co";
const sitemap = await readFile(resolve(dist, "sitemap.xml"), "utf8");
const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => new URL(match[1]));
assert.ok(urls.length >= 30, "Public routes missing from sitemap");
for (const url of urls) {
  assert.equal(url.origin, origin);
  assert.ok(!/^\/(app|admin|maintenance)(\/|$)/.test(url.pathname));
  const html = await readFile(resolve(dist, "." + url.pathname, "index.html"), "utf8");
  assert.ok(
    html.includes(`data-prerendered="${url.pathname}"`),
    `Missing static content: ${url.pathname}`,
  );
  assert.ok(html.includes("<h1"), `Missing rendered heading: ${url.pathname}`);
  assert.ok(
    html.includes(`rel="canonical" href="${url.href}"`),
    `Canonical mismatch: ${url.pathname}`,
  );
  assert.equal((html.match(/<title>/g) || []).length, 1, `Duplicate title: ${url.pathname}`);
  assert.equal(
    (html.match(/name="description"/g) || []).length,
    1,
    `Duplicate description: ${url.pathname}`,
  );
  assert.ok(!html.includes("noindex"), `Public route accidentally excluded: ${url.pathname}`);
  for (const match of html.matchAll(
    /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g,
  ))
    JSON.parse(match[1]);
}
const home = await readFile(resolve(dist, "index.html"), "utf8");
assert.ok(home.includes("Tu negocio, claro."));
assert.ok(home.replace(/<!--.*?-->/g, "").includes("Probar Básico"));
assert.ok(home.includes("/app?plan=basico&amp;periodo=mensual"));
assert.ok(home.includes("FAQPage"));
assert.ok(!home.includes("aggregateRating"), "Do not invent ratings");
assert.ok(!home.includes("SearchAction"), "Do not claim unsupported site search");
await access(resolve(dist, "brand/ferova-isotipo.png"));
await access(resolve(dist, "og/ferova-one-home.png"));
for (const href of [...home.matchAll(/href="(\/[^"#?]*)"/g)].map((m) => m[1])) {
  if (href.startsWith("/assets/") || /\.[a-z0-9]+$/i.test(href))
    await access(resolve(dist, "." + href));
  else await access(resolve(dist, "." + href, "index.html"));
}
const app = await readFile(resolve(dist, "app/index.html"), "utf8");
assert.ok(app.includes("noindex, nofollow"));
assert.ok(!app.includes("Tu negocio, claro."));
console.log(
  `Marketing build: ${urls.length} static public routes, metadata, JSON-LD, home links and private shell verified.`,
);
