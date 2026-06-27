import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Product build: the game entry (index.html). The preview harness has its own config.
export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
});
