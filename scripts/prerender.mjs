import { build } from "vite";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const dist = resolve(root, "dist");
const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
const origin = (await readFile(resolve(root, "src/seo/config.ts"), "utf8")).match(
  /export const SITE_URL\s*=\s*["']([^"']+)["']/,
)[1];
const sitemap = await readFile(resolve(dist, "sitemap.xml"), "utf8");
const routes = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
const template = await readFile(resolve(dist, "index.html"), "utf8");
const shell = template.replace(
  /<title>[\s\S]*?<\/title>|<meta\b[^>]*(?:name="(?:description|robots|twitter:[^"]+)"|property="og:[^"]+")[^>]*>|<link\b[^>]*rel="canonical"[^>]*>/g,
  "",
);
const manifest = JSON.parse(await readFile(resolve(dist, ".vite/manifest.json"), "utf8"));
const cssFiles = [...new Set(Object.values(manifest).flatMap((entry) => entry.css || []))];
const additionalStyles = cssFiles
  .filter((css) => !template.includes(css))
  .map((css) => `<link rel="stylesheet" href="/${escape(css)}" />`)
  .join("\n");

await build({
  build: {
    ssr: "src/entry-prerender.tsx",
    outDir: ".prerender",
    manifest: false,
    emptyOutDir: true,
    rollupOptions: { output: { entryFileNames: "entry-prerender.mjs" } },
  },
});
const { renderPage } = await import(
  pathToFileURL(resolve(root, ".prerender/entry-prerender.mjs")).href
);

for (const route of routes) {
  const { html, seo } = await renderPage(route);
  if (seo.path !== route && !(seo.path === "/maintenance" && seo.noindex))
    throw new Error(`Unexpected canonical for ${route}: ${seo.path}`);
  const title = `${seo.title} | Ferova One`;
  const image = seo.ogImage || `${origin}/og/ferova-one-home.png`;
  const metadata = `<title>${escape(title)}</title>
<meta name="description" content="${escape(seo.description)}" />
<meta name="robots" content="${seo.noindex ? "noindex, nofollow" : "index, follow, max-image-preview:large"}" />
<link rel="canonical" href="${escape(origin + seo.path)}" />
<meta property="og:type" content="${escape(seo.type || "website")}" />
<meta property="og:site_name" content="Ferova One" />
<meta property="og:title" content="${escape(title)}" />
<meta property="og:description" content="${escape(seo.description)}" />
<meta property="og:url" content="${escape(origin + seo.path)}" />
<meta property="og:image" content="${escape(image)}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${escape(title)}" />
<meta name="twitter:description" content="${escape(seo.description)}" />
<meta name="twitter:image" content="${escape(image)}" />
${seo.jsonLd ? `<script id="seo-jsonld" type="application/ld+json">${JSON.stringify(seo.jsonLd).replace(/</g, "\\u003c")}</script>` : ""}
${additionalStyles}
<noscript><style>[style*="opacity:0"]{opacity:1!important;transform:none!important}</style></noscript>`;
  const page = shell
    .replace("</head>", `${metadata}\n</head>`)
    .replace(
      '<div id="root"></div>',
      `<div id="root" data-prerendered="${escape(route)}">${html}</div>`,
    );
  if (!page.includes("data-prerendered=")) throw new Error("HTML root placeholder missing");
  const target = resolve(dist, "." + route, "index.html");
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, page);
  // Vite preview and clean-URL static hosts resolve /ruta to ruta.html.
  // Directory indexes also support hosts that normalize to /ruta/.
  if (route !== "/") await writeFile(resolve(dist, "." + route + ".html"), page);
}
// Private/unknown routes have an empty shell, never a static copy of marketing content.
for (const route of ["app", "admin", "maintenance"]) {
  const target = resolve(dist, route, "index.html");
  await mkdir(dirname(target), { recursive: true });
  const privateShell = shell.replace(
    "</head>",
    '<meta name="robots" content="noindex, nofollow" /><title>Ferova One · Acceso</title></head>',
  );
  await writeFile(target, privateShell);
  await writeFile(resolve(dist, route + ".html"), privateShell);
}
await writeFile(resolve(dist, "200.html"), shell);
await writeFile(
  resolve(dist, "404.html"),
  shell.replace("</head>", '<meta name="robots" content="noindex, nofollow" /></head>'),
);
console.log(
  `[prerender] ${routes.length} public routes with static content, metadata and JSON-LD.`,
);
