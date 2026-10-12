import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import postgres from "postgres";
import * as schema from "./schema";

/** Any Drizzle Postgres database with our schema: postgres-js in the app, PGlite in tests. */
export type Database = PgDatabase<PgQueryResultHKT, typeof schema>;

let instance: Database | null = null;

/** The app's database, created on first use from DATABASE_URL (server environment only). */
export function getDb(): Database {
  if (instance) return instance;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set. Copy it into .env.local (see README).");
  const max = Number.parseInt(process.env.DATABASE_POOL_MAX ?? "10", 10);
  const client = postgres(url, { max: Number.isSafeInteger(max) && max > 0 ? max : 10, prepare: false });
  instance = drizzle(client, { schema });
  return instance;
}

export { schema };
