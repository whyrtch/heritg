import { FlatCompat } from "@eslint/eslintrc";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const compat = new FlatCompat({ baseDirectory: dirname });
const config = [
  { ignores: [".next/**", "node_modules/**", "coverage/**", "next-env.d.ts"] },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  { rules: { "@next/next/no-img-element": "off" } },
  // Server code (database, sessions, secrets) must never reach the browser bundle. Only API routes and
  // server modules may import it; `import "server-only"` in src/server/db/client.ts is the second guard.
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/server/**", "src/app/api/**"],
    rules: { "no-restricted-imports": ["error", { patterns: [{ group: ["@/server/*", "**/server/*"], message: "Server code may only be imported from src/server/** and src/app/api/**." }] }] },
  },
];
export default config;
