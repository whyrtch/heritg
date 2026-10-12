import { existsSync } from "node:fs";
import { defineConfig } from "drizzle-kit";

// Same env files as Next.js and the CLI scripts, so `npm run db:migrate` targets the DATABASE_URL in
// .env.local (an explicit environment variable still wins). No fallback: migrating the wrong database
// silently would be worse than failing.
for (const file of [".env.local", ".env"]) if (existsSync(file)) process.loadEnvFile(file);

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/server/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
  strict: true,
  verbose: true,
});
