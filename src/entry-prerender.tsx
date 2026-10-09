import { renderToPipeableStream } from "react-dom/server";
import { StaticRouter } from "react-router-dom/server";
import { PassThrough } from "node:stream";
import { AppRoutes } from "./router";
import { ToastProvider } from "./components/ui/toast";
import { SeoCollector, type SeoHeadProps } from "./seo/SeoHead";

/** Same route tree as the client, but no browser or authenticated data. */
export function renderPage(path: string): Promise<{ html: string; seo: SeoHeadProps }> {
  return new Promise((resolve, reject) => {
    let seo: SeoHeadProps | undefined;
    let failed = false;
    const output = new PassThrough();
    const chunks: Buffer[] = [];
    output.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    output.on("error", reject);
    output.on("end", () => {
      clearTimeout(timeout);
      if (failed) return;
      if (!seo) {
        reject(new Error(`Missing SEO metadata for ${path}`));
        return;
      }
      resolve({ html: Buffer.concat(chunks).toString("utf8"), seo });
    });
    const stream = renderToPipeableStream(
      <SeoCollector.Provider
        value={(value) => {
          seo = value;
        }}
      >
        <StaticRouter location={path}>
          <ToastProvider>
            <AppRoutes />
          </ToastProvider>
        </StaticRouter>
      </SeoCollector.Provider>,
      {
        onAllReady() {
          stream.pipe(output);
        },
        onError(error) {
          failed = true;
          clearTimeout(timeout);
          reject(error);
        },
      },
    );
    const timeout = setTimeout(() => {
      failed = true;
      stream.abort();
      reject(new Error(`Prerender timed out: ${path}`));
    }, 30000);
  });
}
