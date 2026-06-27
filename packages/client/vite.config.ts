import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

/**
 * Dev convenience: serve the preview harness at /preview (no .html), mirroring the
 * production clean-URL behavior (Vercel `cleanUrls`). So `pnpm dev` → /preview works
 * the same as the deployed site.
 */
function previewCleanUrlDev(): Plugin {
  return {
    name: "preview-clean-url-dev",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        if (req.url === "/preview" || req.url === "/preview/") req.url = "/preview.html";
        next();
      });
    },
  };
}

/**
 * The product is ONE multi-page app, deployed as a single Vercel project:
 *   index.html   → the game      (served at /)
 *   preview.html → the preview    (served at /preview via Vercel cleanUrls)
 * Both entries share chunks (e.g. the three.js bundle), so the preview adds little
 * weight. The standalone, backend-free preview artifact still lives in
 * vite.preview.config.ts for optional separate static hosting.
 */
export default defineConfig({
  plugins: [react(), previewCleanUrlDev()],
  build: {
    rollupOptions: {
      input: {
        index: resolve(__dirname, "index.html"),
        preview: resolve(__dirname, "preview.html"),
      },
    },
  },
  server: { port: 5173 },
});
