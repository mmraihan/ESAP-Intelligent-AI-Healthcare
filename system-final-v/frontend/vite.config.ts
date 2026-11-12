/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
import { copyFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Copy the built index.html to 404.html. vercel.json rewrites only the real
 * routes to index.html; anything else gets Vercel's 404.html with a 404 status
 * (QA issue 12), which is the same app, so it renders its "does not exist" page.
 */
function notFoundPage() {
  return {
    name: "esap-404-page",
    apply: "build" as const,
    closeBundle() {
      const dist = resolve(fileURLToPath(new URL(".", import.meta.url)), "dist");
      copyFileSync(resolve(dist, "index.html"), resolve(dist, "404.html"));
    },
  };
}

// Frontend-only demo build: no backend proxy, every data source is mocked in src/mock.
export default defineConfig({
  plugins: [react(), notFoundPage()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  server: { port: 5175, open: true },
  build: {
    rollupOptions: {
      output: {
        // React changes far less often than the app, so a separate chunk stays
        // cached across deploys.
        manualChunks: { react: ["react", "react-dom", "react-router-dom"] },
      },
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    include: ["src/**/*.test.tsx", "src/**/*.test.ts"],
    setupFiles: ["./src/test/setup.ts"],
  },
});
