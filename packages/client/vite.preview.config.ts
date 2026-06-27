import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { renameSync, existsSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Backend-free static build of the PREVIEW HARNESS ONLY. The product/game entry is
 * never included here. We build from preview.html (the dev entry) but emit it as
 * **index.html** with relative asset URLs (base "./"), so the harness deploys to
 * any static host at "/" — open the folder and it just runs, no server.
 */
const OUT_DIR = "dist-preview";

/** Rename the emitted preview.html → index.html so the host serves it at "/". */
function emitAsIndex(): Plugin {
  return {
    name: "preview-emit-as-index",
    closeBundle() {
      const from = resolve(__dirname, OUT_DIR, "preview.html");
      const to = resolve(__dirname, OUT_DIR, "index.html");
      if (existsSync(from)) renameSync(from, to);
    },
  };
}

export default defineConfig({
  base: "./",
  plugins: [react(), emitAsIndex()],
  build: {
    outDir: OUT_DIR,
    rollupOptions: { input: resolve(__dirname, "preview.html") },
  },
  server: { port: 5174 },
});
