import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    exclude: ["tests/api/**", "node_modules/**", ".next/**"],
  },
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } }
});
