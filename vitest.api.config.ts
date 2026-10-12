import { defineConfig } from "vitest/config";
import path from "node:path";

// API and database tests: Node environment, in-process PostgreSQL (PGlite), no browser.
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/api/**/*.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // `server-only` throws outside the React server bundle; tests run server code directly.
      "server-only": path.resolve(__dirname, "./tests/api/server-only.ts"),
    },
  },
});
