import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { people, photos, publicPhotos, publications, relationships, sessions, trees, users } from "@/server/db/schema";
import { createTestDb, type TestDb } from "./db";

let t: TestDb;
let ownerId: string;

beforeAll(async () => { t = await createTestDb(); });
afterAll(async () => { await t.close(); });
beforeEach(async () => {
  await t.client.exec("truncate users, trees, login_attempts cascade");
  [{ id: ownerId }] = await t.db.insert(users).values({ email: "owner@heritg.test", passwordHash: "x" }).returning({ id: users.id });
  await t.db.insert(trees).values([{ id: "tree-a", ownerId, name: "Keluarga A", schemaVersion: 2 }, { id: "tree-b", ownerId, name: "Keluarga B", schemaVersion: 2 }]);
  await t.db.insert(people).values([
    { treeId: "tree-a", id: "budi", name: "Budi", gender: "male" },
    { treeId: "tree-a", id: "sari", name: "Sari", gender: "female" },
    { treeId: "tree-b", id: "lain", name: "Lain", gender: "unspecified" },
  ]);
});

/** Postgres error code of a rejected statement (23514 check, 23503 foreign key, 23505 unique). */
async function rejection(run: () => Promise<unknown>): Promise<string> {
  try { await run(); } catch (error) { return String((error as { code?: string }).code ?? (error as { cause?: { code?: string } }).cause?.code ?? error); }
  throw new Error("Expected the database to reject this write.");
}

describe("database schema", () => {
  it("stores a valid tree with people, relationships and a photo", async () => {
    await t.db.insert(relationships).values([
      { treeId: "tree-a", id: "r1", type: "partner", fromPersonId: "budi", toPersonId: "sari", kind: null, status: "married", marriedOn: "1990-05-17" },
    ]);
    await t.db.insert(photos).values({ treeId: "tree-a", personId: "budi", mime: "image/webp", bytes: new Uint8Array(100), sha256: "a".repeat(64) });
    expect(await t.db.select().from(relationships)).toHaveLength(1);
  });

  it("rejects invalid people", async () => {
    const base = { treeId: "tree-a", id: "x", name: "X", gender: "male" as const };
    expect(await rejection(() => t.db.insert(people).values({ ...base, gender: "nonbinary" as "male" }))).toBe("23514");
    expect(await rejection(() => t.db.insert(people).values({ ...base, name: "" }))).toBe("23514");
    expect(await rejection(() => t.db.insert(people).values({ ...base, name: "x".repeat(121) }))).toBe("23514");
    expect(await rejection(() => t.db.insert(people).values({ ...base, birthOrder: 0 }))).toBe("23514");
    expect(await rejection(() => t.db.insert(people).values({ ...base, birthOrder: 100 }))).toBe("23514");
    expect(await rejection(() => t.db.insert(people).values({ ...base, birthDate: "21-06-1961" }))).toBe("23514");
    expect(await rejection(() => t.db.insert(people).values({ ...base, photoUrl: "http://example.com/a.jpg" }))).toBe("23514");
    expect(await rejection(() => t.db.insert(people).values({ ...base, notes: "x".repeat(10001) }))).toBe("23514");
  });

  it("enforces relationship details by type, including NULLs", async () => {
    const base = { treeId: "tree-a", fromPersonId: "budi", toPersonId: "sari" };
    expect(await rejection(() => t.db.insert(relationships).values({ ...base, id: "a", type: "parent-child", kind: null }))).toBe("23514");
    expect(await rejection(() => t.db.insert(relationships).values({ ...base, id: "b", type: "parent-child", kind: "biological", status: "married" }))).toBe("23514");
    expect(await rejection(() => t.db.insert(relationships).values({ ...base, id: "c", type: "partner", kind: "step", status: "married" }))).toBe("23514");
    expect(await rejection(() => t.db.insert(relationships).values({ ...base, id: "d", type: "partner", kind: null, status: null }))).toBe("23514");
    expect(await rejection(() => t.db.insert(relationships).values({ ...base, id: "e", type: "partner", kind: null, status: "married", marriedOn: "1990" }))).toBe("23514");
    expect(await rejection(() => t.db.insert(relationships).values({ ...base, id: "f", type: "parent-child", kind: "biological", toPersonId: "budi" }))).toBe("23514");
  });

  it("keeps relationships and photos inside their own tree", async () => {
    expect(await rejection(() => t.db.insert(relationships).values({ treeId: "tree-a", id: "cross", type: "parent-child", kind: "biological", fromPersonId: "budi", toPersonId: "lain" }))).toBe("23503");
    expect(await rejection(() => t.db.insert(photos).values({ treeId: "tree-a", personId: "lain", mime: "image/jpeg", bytes: new Uint8Array(10), sha256: "b".repeat(64) }))).toBe("23503");
  });

  it("limits photo size and type", async () => {
    const base = { treeId: "tree-a", personId: "budi", sha256: "c".repeat(64) };
    expect(await rejection(() => t.db.insert(photos).values({ ...base, mime: "image/jpeg", bytes: new Uint8Array(49153) }))).toBe("23514");
    expect(await rejection(() => t.db.insert(photos).values({ ...base, mime: "image/png" as "image/jpeg", bytes: new Uint8Array(10) }))).toBe("23514");
    expect(await rejection(() => t.db.insert(photos).values({ ...base, mime: "image/jpeg", bytes: new Uint8Array(0) }))).toBe("23514");
    await t.db.insert(photos).values({ ...base, mime: "image/jpeg", bytes: new Uint8Array(49152) });
  });

  it("cascades deletes from people and trees", async () => {
    await t.db.insert(relationships).values({ treeId: "tree-a", id: "r", type: "parent-child", kind: "biological", fromPersonId: "budi", toPersonId: "sari" });
    await t.db.insert(photos).values({ treeId: "tree-a", personId: "sari", mime: "image/jpeg", bytes: new Uint8Array(10), sha256: "d".repeat(64) });
    await t.db.delete(people).where(eq(people.id, "sari"));
    expect(await t.db.select().from(relationships)).toHaveLength(0);
    expect(await t.db.select().from(photos)).toHaveLength(0);
    await t.db.delete(trees).where(eq(trees.id, "tree-a"));
    expect(await t.db.select().from(people).where(eq(people.treeId, "tree-a"))).toHaveLength(0);
  });

  it("keeps tree publication fields consistent", async () => {
    expect(await rejection(() => t.db.update(trees).set({ visibility: "unlisted", publicId: "public_identifier_1234567890" }).where(eq(trees.id, "tree-a")))).toBe("23514");
    expect(await rejection(() => t.db.update(trees).set({ publicId: "public_identifier_1234567890" }).where(eq(trees.id, "tree-a")))).toBe("23514");
    expect(await rejection(() => t.db.update(trees).set({ visibility: "unlisted", publicId: "public_identifier_1234567890", publishedRevision: 5 }).where(eq(trees.id, "tree-a")))).toBe("23514");
    await t.db.update(trees).set({ visibility: "unlisted", publicId: "public_identifier_1234567890", publishedRevision: 0 }).where(eq(trees.id, "tree-a"));
    expect(await rejection(() => t.db.update(trees).set({ visibility: "unlisted", publicId: "public_identifier_1234567890", publishedRevision: 0 }).where(eq(trees.id, "tree-b")))).toBe("23505");
  });

  it("validates publications, their photos and sessions", async () => {
    const publication = { treeId: "tree-a", name: "Keluarga A", schemaVersion: 2, publishedRevision: 0, snapshot: { people: [], relationships: [] } };
    expect(await rejection(() => t.db.insert(publications).values({ ...publication, publicId: "short" }))).toBe("23514");
    await t.db.insert(publications).values({ ...publication, publicId: "public_identifier_1234567890" });
    expect(await rejection(() => t.db.insert(publicPhotos).values({ publicId: "missing_public_identifier_123", personId: "budi", mime: "image/jpeg", bytes: new Uint8Array(10), sha256: "e".repeat(64) }))).toBe("23503");
    expect(await rejection(() => t.db.insert(sessions).values({ tokenHash: new Uint8Array(16), userId: ownerId, expiresAt: new Date(Date.now() + 1000) }))).toBe("23514");
    await t.db.insert(sessions).values({ tokenHash: new Uint8Array(32), userId: ownerId, expiresAt: new Date(Date.now() + 1000) });
  });

  it("requires lowercase unique emails", async () => {
    expect(await rejection(() => t.db.insert(users).values({ email: "Owner@Heritg.test", passwordHash: "x" }))).toBe("23514");
    expect(await rejection(() => t.db.insert(users).values({ email: "owner@heritg.test", passwordHash: "x" }))).toBe("23505");
    expect(await rejection(() => t.db.insert(users).values({ email: "no-at-sign", passwordHash: "x" }))).toBe("23514");
  });
});
