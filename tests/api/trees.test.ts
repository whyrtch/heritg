import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createSession } from "@/server/auth/session";
import { createOwner } from "@/server/auth/users";
import { people, relationships } from "@/server/db/schema";
import { getTree, listTrees, postTree, putTree, removeTree } from "@/server/trees/handlers";
import { createTestDb, type TestDb } from "./db";

const ORIGIN = "http://localhost:3000";
let t: TestDb;
let owner: { id: string; cookie: string }, other: { id: string; cookie: string };

async function account(email: string) {
  const { id } = await createOwner(t.db, email, "correct horse battery");
  const { token } = await createSession(t.db, id);
  return { id, cookie: `__Host-heritg_session=${token}` };
}

function call(method: string, path: string, { cookie, body, origin = ORIGIN }: { cookie?: string; body?: unknown; origin?: string } = {}): Request {
  const headers = new Headers({ origin });
  if (cookie) headers.set("cookie", cookie);
  if (body !== undefined) headers.set("content-type", "application/json");
  return new Request(`${ORIGIN}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
}

const person = (id: string, extra: Record<string, unknown> = {}) => ({ id, name: id.toUpperCase(), gender: "unspecified", birthDate: "", deathDate: "", birthOrder: null, residence: "", notes: "", photoUrl: "", sortOrder: 0, updatedAt: "2026-01-01T00:00:00.000Z", ...extra });
const tree = (id = "tree-1", extra: Record<string, unknown> = {}) => ({
  id, ownerId: "client-says-someone-else", name: "Keluarga Uji", visibility: "unlisted", publicId: "client_controlled_public_id", revision: 99, schemaVersion: 2,
  createdAt: "2000-01-01T00:00:00.000Z", updatedAt: "2000-01-01T00:00:00.000Z", publishedRevision: 3,
  people: [person("budi", { gender: "male", sortOrder: 0 }), person("sari", { gender: "female", sortOrder: 1 })],
  relationships: [{ id: "r1", type: "partner", fromPersonId: "budi", toPersonId: "sari", kind: null, status: "married", marriedOn: "1990-05-17", updatedAt: "x" }],
  ...extra,
});
const create = (cookie: string, body = tree()) => postTree(call("POST", "/api/trees", { cookie, body: { tree: body } }), t.db);
const save = (cookie: string, body: ReturnType<typeof tree>, expectedRevision: number, id = body.id) => putTree(call("PUT", `/api/trees/${id}`, { cookie, body: { tree: body, expectedRevision } }), t.db, id);
const errorCode = async (response: Response) => (await response.json() as { error: { code: string } }).error.code;

beforeAll(async () => { process.env.APP_URL = ORIGIN; t = await createTestDb(); });
afterAll(async () => { await t.close(); });
beforeEach(async () => {
  await t.client.exec("truncate users, login_attempts cascade");
  owner = await account("owner@heritg.test");
  other = await account("other@heritg.test");
});

describe("trees API: access", () => {
  it("requires a session for every route", async () => {
    expect((await listTrees(call("GET", "/api/trees"), t.db)).status).toBe(401);
    expect((await create("")).status).toBe(401);
    expect((await getTree(call("GET", "/api/trees/tree-1"), t.db, "tree-1")).status).toBe(401);
    expect((await save("", tree(), 0)).status).toBe(401);
    expect((await removeTree(call("DELETE", "/api/trees/tree-1"), t.db, "tree-1")).status).toBe(401);
  });

  it("creates a tree owned by the session user, ignoring client-controlled fields", async () => {
    const response = await create(owner.cookie);
    expect(response.status).toBe(201);
    const { tree: created } = await response.json();
    expect(created).toMatchObject({ id: "tree-1", ownerId: owner.id, revision: 0, visibility: "private", publicId: null, publishedRevision: null, schemaVersion: 2 });
    expect(created.createdAt).not.toBe("2000-01-01T00:00:00.000Z");
    expect(created.people.map((item: { id: string }) => item.id)).toEqual(["budi", "sari"]);
    expect(created.relationships[0]).toMatchObject({ type: "partner", status: "married", marriedOn: "1990-05-17", kind: null });
    const list = await (await listTrees(call("GET", "/api/trees", { cookie: owner.cookie }), t.db)).json();
    expect(list.trees.map((item: { id: string }) => item.id)).toEqual(["tree-1"]);
  });

  it("hides another owner's tree completely", async () => {
    await create(owner.cookie);
    expect((await getTree(call("GET", "/api/trees/tree-1", { cookie: other.cookie }), t.db, "tree-1")).status).toBe(404);
    expect((await save(other.cookie, tree(), 0)).status).toBe(404);
    expect((await removeTree(call("DELETE", "/api/trees/tree-1", { cookie: other.cookie }), t.db, "tree-1")).status).toBe(404);
    expect((await (await listTrees(call("GET", "/api/trees", { cookie: other.cookie }), t.db)).json()).trees).toEqual([]);
    // Re-creating the id: a conflict for its owner (resumable migration), "not found" for anyone else.
    expect((await create(owner.cookie)).status).toBe(409);
    expect((await create(other.cookie)).status).toBe(404);
    const stillOwners = await (await getTree(call("GET", "/api/trees/tree-1", { cookie: owner.cookie }), t.db, "tree-1")).json();
    expect(stillOwners.tree.name).toBe("Keluarga Uji");
  });

  it("refuses cross-site writes", async () => {
    await create(owner.cookie);
    const forged = putTree(call("PUT", "/api/trees/tree-1", { cookie: owner.cookie, origin: "https://evil.example", body: { tree: tree(), expectedRevision: 0 } }), t.db, "tree-1");
    expect((await forged).status).toBe(403);
    expect((await removeTree(call("DELETE", "/api/trees/tree-1", { cookie: owner.cookie, origin: "https://evil.example" }), t.db, "tree-1")).status).toBe(403);
  });
});

describe("trees API: saving", () => {
  it("saves edits with a revision check and returns the stored tree", async () => {
    await create(owner.cookie);
    const edited = tree("tree-1", {
      name: "Keluarga Santoso",
      people: [person("budi", { gender: "male", residence: "Solo" }), person("sari", { gender: "female", sortOrder: 1 }), person("ani", { gender: "female", birthOrder: 1, sortOrder: 2 })],
      relationships: [
        { id: "r1", type: "partner", fromPersonId: "budi", toPersonId: "sari", kind: null, status: "ex", marriedOn: "", updatedAt: "x" },
        { id: "r2", type: "parent-child", fromPersonId: "budi", toPersonId: "ani", kind: "adoptive", status: null, marriedOn: "", updatedAt: "x" },
      ],
    });
    const response = await save(owner.cookie, edited, 0);
    expect(response.status).toBe(200);
    const { tree: saved } = await response.json();
    expect(saved).toMatchObject({ name: "Keluarga Santoso", revision: 1 });
    expect(saved.people.find((item: { id: string }) => item.id === "budi").residence).toBe("Solo");
    expect(saved.relationships).toHaveLength(2);
  });

  it("answers a stale save with 409 and the current tree", async () => {
    await create(owner.cookie);
    expect((await save(owner.cookie, tree("tree-1", { name: "Pertama" }), 0)).status).toBe(200);
    const stale = await save(owner.cookie, tree("tree-1", { name: "Kedua" }), 0);
    expect(stale.status).toBe(409);
    const body = await stale.json();
    expect(body.error).toMatchObject({ code: "conflict", details: { current: { name: "Pertama", revision: 1 } } });
  });

  it("removes people that are gone, together with their relationships", async () => {
    await create(owner.cookie);
    const response = await save(owner.cookie, tree("tree-1", { people: [person("budi")], relationships: [] }), 0);
    expect((await response.json()).tree.people).toHaveLength(1);
    expect(await t.db.select().from(people).where(eq(people.treeId, "tree-1"))).toHaveLength(1);
    expect(await t.db.select().from(relationships).where(eq(relationships.treeId, "tree-1"))).toHaveLength(0);
  });

  it("saves a 500-person tree in one request", async () => {
    await create(owner.cookie);
    const many = Array.from({ length: 500 }, (_, index) => person(`p${index}`, { sortOrder: index }));
    const chain = many.slice(1).map((item, index) => ({ id: `c${index}`, type: "parent-child", fromPersonId: `p${index}`, toPersonId: item.id, kind: "biological", status: null, marriedOn: "", updatedAt: "x" }));
    const response = await save(owner.cookie, tree("tree-1", { people: many, relationships: chain }), 0);
    expect(response.status).toBe(200);
    const { tree: saved } = await response.json();
    expect(saved.people).toHaveLength(500);
    expect(saved.relationships).toHaveLength(499);
  });

  it("deletes a tree with everything in it", async () => {
    await create(owner.cookie);
    expect((await removeTree(call("DELETE", "/api/trees/tree-1", { cookie: owner.cookie }), t.db, "tree-1")).status).toBe(200);
    expect(await t.db.select().from(people)).toHaveLength(0);
    expect((await getTree(call("GET", "/api/trees/tree-1", { cookie: owner.cookie }), t.db, "tree-1")).status).toBe(404);
  });
});

describe("trees API: validation", () => {
  const rejects = async (body: ReturnType<typeof tree>) => {
    const response = await create(owner.cookie, body);
    expect(response.status).toBe(400);
    expect(await errorCode(response)).toBe("invalid");
  };

  it("rejects invalid people", async () => {
    await rejects(tree("t", { people: [person("a", { gender: "nonbinary" })], relationships: [] }));
    await rejects(tree("t", { people: [person("a", { birthOrder: 0 })], relationships: [] }));
    await rejects(tree("t", { people: [person("a", { name: "" })], relationships: [] }));
    await rejects(tree("t", { people: [person("a", { birthDate: "21-06-1961" })], relationships: [] }));
    await rejects(tree("t", { people: [person("a", { photoUrl: "http://example.com/a.jpg" })], relationships: [] }));
    await rejects(tree("t", { people: [person("a"), person("a")], relationships: [] }));
    await rejects(tree("t", { people: [person("a/../b")], relationships: [] }));
  });

  it("rejects relationships outside the tree or with the wrong details", async () => {
    const rel = (extra: Record<string, unknown>) => tree("t", { relationships: [{ id: "r", type: "parent-child", fromPersonId: "budi", toPersonId: "sari", kind: "biological", status: null, marriedOn: "", updatedAt: "x", ...extra }] });
    await rejects(rel({ toPersonId: "stranger" }));
    await rejects(rel({ toPersonId: "budi" }));
    await rejects(rel({ status: "married" }));
    await rejects(rel({ type: "partner", kind: "step", status: "married" }));
    await rejects(rel({ type: "partner", kind: null, status: "married", marriedOn: "1990" }));
  });

  it("rejects NUL characters and odd whitespace instead of failing in the database", async () => {
    await rejects(tree("t", { people: [person("a", { notes: "before\u0000after" })], relationships: [] }));
    await rejects(tree("t", { name: "Keluarga\u0000", people: [], relationships: [] }));
    await rejects(tree("t", { people: [person("a", { photoUrl: "https://example.com/a\u0085b.jpg" })], relationships: [] }));
  });

  it("rejects schema v1 bodies and mismatched ids", async () => {
    await rejects(tree("t", { schemaVersion: 1 }));
    await rejects(tree("t", { people: [{ id: "a", firstName: "Budi", lastName: "Uji", gender: "male", birthDate: "", deathDate: "", notes: "", photoUrl: "", sortOrder: 0 }], relationships: [] } as never));
    await create(owner.cookie);
    const mismatch = await save(owner.cookie, tree("tree-1"), 0, "tree-2");
    expect(mismatch.status).toBe(400);
  });
});
