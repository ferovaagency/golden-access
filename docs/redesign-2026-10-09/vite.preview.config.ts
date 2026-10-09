import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: "preview-no-backend",
      enforce: "pre",
      resolveId(source) {
        if (/(?:^|\/)lib\/supabase(?:\.ts)?$/.test(source))
          throw new Error("The visual preview must not include Supabase: " + source);
      },
    },
  ],
  resolve: {
    alias: [
      {
        find: /.*\/lib\/(plannerService|paymentGatewaysService|accountsService|projectKpisService)$/,
        replacement: path.resolve("docs/redesign-2026-10-09/offline-services.ts"),
      },
    ],
  },
  build: {
    outDir: ".interface-preview",
    emptyOutDir: true,
    rollupOptions: { input: path.resolve("docs/redesign-2026-10-09/interfaz-real.html") },
  },
  preview: { host: "127.0.0.1", port: 4175, strictPort: true },
});
