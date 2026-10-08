import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: { environment: "jsdom", globals: true, setupFiles: ["./src/test/setup.ts"], css: false, restoreMocks: true },
  server: { port: 5173, proxy: { "/api": { target: process.env.VITE_PROXY_TARGET ?? "http://localhost:8000", ws: true } } },
});
