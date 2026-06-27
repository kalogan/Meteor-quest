import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

/**
 * Backend-free static build of the PREVIEW HARNESS ONLY. Emits preview.html as the
 * single entry with relative asset URLs, so it deploys to any static host. The
 * product/game entry is never included here.
 */
export default defineConfig({
  base: "./",
  plugins: [react()],
  build: {
    outDir: "dist-preview",
    rollupOptions: { input: resolve(__dirname, "preview.html") },
  },
  server: { port: 5174 },
});
