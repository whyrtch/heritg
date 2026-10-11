import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "@/server/db/schema";
import type { Database } from "@/server/db/client";

export type TestDb = { db: Database; client: PGlite; close: () => Promise<void> };

/** A fresh in-process PostgreSQL (PGlite) with every migration in ./drizzle applied. */
export async function createTestDb(): Promise<TestDb> {
  const client = new PGlite();
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: path.resolve(__dirname, "../../drizzle") });
  return { db: db as unknown as Database, client, close: () => client.close() };
}
