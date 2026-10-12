import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createSession } from "@/server/auth/session";
import { createOwner } from "@/server/auth/users";
import { publications } from "@/server/db/schema";
import { deletePublication, getPublicSnapshot, putPublication } from "@/server/publications/handlers";
import { postTree, putTree, removeTree } from "@/server/trees/handlers";
import { createTestDb, type TestDb } from "./db";

const ORIGIN = "http://localhost:3000";
const LINK = "public_identifier_abcdefghij", OTHER_LINK = "public_identifier_klmnopqrst";
let t: TestDb;
let owner: { id: string; email: string; cookie: string }, other: { id: string; email: string; cookie: string };

async function account(email: string) {
  const { id } = await createOwner(t.db, email, "correct horse battery");
  const { token } = await createSession(t.db, id);
  return { id, email, cookie: `__Host-heritg_session=${token}` };
}
function call(method: string, path: string, { cookie, body, origin = ORIGIN }: { cookie?: string; body?: unknown; origin?: string } = {}): Request {
  const headers = new Headers({ origin });
  if (cookie) headers.set("cookie", cookie);
  if (body !== undefined) headers.set("content-type", "application/json");
  return new Request(`${ORIGIN}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
}
const person = (id: string, extra: Record<string, unknown> = {}) => ({ id, name: id.toUpperCase(), gender: "unspecified", birthDate: "", deathDate: "", birthOrder: null, residence: "", notes: "", photoUrl: "", sortOrder: 0, ...extra });
const tree = (extra: Record<string, unknown> = {}) => ({ id: "tree-1", name: "Keluarga Uji", schemaVersion: 2, people: [person("budi", { notes: "Catatan" })], relationships: [], ...extra });

const publish = (cookie: string, publicId: string, expectedRevision: number, origin = ORIGIN) => putPublication(call("PUT", "/api/trees/tree-1/publication", { cookie, origin, body: { publicId, expectedRevision } }), t.db, "tree-1");
const unpublish = (cookie: string, expectedRevision = 1) => deletePublication(call("DELETE", "/api/trees/tree-1/publication", { cookie, body: { expectedRevision } }), t.db, "tree-1");
const view = (publicId: string) => getPublicSnapshot(call("GET", `/api/public/${publicId}`), t.db, publicId);

beforeAll(async () => { process.env.APP_URL = ORIGIN; t = await createTestDb(); });
afterAll(async () => { await t.close(); });
beforeEach(async () => {
  await t.client.exec("truncate users, login_attempts cascade");
  owner = await account("owner@heritg.test");
  other = await account("other@heritg.test");
  await postTree(call("POST", "/api/trees", { cookie: owner.cookie, body: { tree: tree() } }), t.db);
});

describe("publishing", () => {
  it("publishes the stored tree and switches it to unlisted", async () => {
    const response = await publish(owner.cookie, LINK, 0);
    expect(response.status).toBe(200);
    expect((await response.json()).tree).toMatchObject({ visibility: "unlisted", publicId: LINK, revision: 1, publishedRevision: 1 });
  });

  it("lets anyone with the link read it, without any owner data", async () => {
    await publish(owner.cookie, LINK, 0);
    const response = await view(LINK);
    expect(response.status).toBe(200);
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    expect(response.headers.get("cache-control")).toBe("no-store");
    const text = await response.text();
    expect(JSON.parse(text).snapshot).toMatchObject({ publicId: LINK, name: "Keluarga Uji", publishedRevision: 1, people: [{ id: "budi", name: "BUDI", notes: "Catatan" }] });
    for (const secret of [owner.id, owner.email, "ownerId", "tree-1"]) expect(text).not.toContain(secret);
  });

  it("only the owner can publish or revoke", async () => {
    expect((await publish("", LINK, 0)).status).toBe(401);
    expect((await publish(other.cookie, LINK, 0)).status).toBe(404);
    expect((await publish(owner.cookie, LINK, 0, "https://evil.example")).status).toBe(403);
    await publish(owner.cookie, LINK, 0);
    expect((await unpublish(other.cookie)).status).toBe(404);
    expect((await view(LINK)).status).toBe(200);
  });

  it("shares saved data only, and refreshes the snapshot when republished", async () => {
    await publish(owner.cookie, LINK, 0);
    await putTree(call("PUT", "/api/trees/tree-1", { cookie: owner.cookie, body: { tree: tree({ name: "Nama Baru" }), expectedRevision: 1 } }), t.db, "tree-1");
    expect((await (await view(LINK)).json()).snapshot.name).toBe("Keluarga Uji");
    expect((await publish(owner.cookie, LINK, 0)).status).toBe(409);
    expect((await publish(owner.cookie, LINK, 2)).status).toBe(200);
    expect((await (await view(LINK)).json()).snapshot).toMatchObject({ name: "Nama Baru", publishedRevision: 3 });
  });

  it("regenerating the link kills the old URL", async () => {
    await publish(owner.cookie, LINK, 0);
    expect((await publish(owner.cookie, OTHER_LINK, 1)).status).toBe(200);
    expect((await view(LINK)).status).toBe(404);
    expect((await view(OTHER_LINK)).status).toBe(200);
    expect(await t.db.select().from(publications)).toHaveLength(1);
  });

  it("revoking deletes the snapshot and makes the tree private", async () => {
    await publish(owner.cookie, LINK, 0);
    // A save still on its way (stale revision) blocks the revoke instead of racing it.
    expect((await unpublish(owner.cookie, 0)).status).toBe(409);
    expect((await view(LINK)).status).toBe(200);
    const response = await unpublish(owner.cookie);
    expect((await response.json()).tree).toMatchObject({ visibility: "private", publicId: null, publishedRevision: null, revision: 2 });
    expect((await view(LINK)).status).toBe(404);
    expect(await t.db.select().from(publications)).toHaveLength(0);
  });

  it("answers unknown, revoked and malformed links identically", async () => {
    await publish(owner.cookie, LINK, 0);
    await unpublish(owner.cookie);
    const bodies = await Promise.all([LINK, "never_published_link_12345", "../etc", "x"].map(async id => { const response = await view(id); return [response.status, await response.text()]; }));
    expect(new Set(bodies.map(item => JSON.stringify(item))).size).toBe(1);
    expect(bodies[0][0]).toBe(404);
  });

  it("refuses link ids that are malformed or used by another tree", async () => {
    expect((await publish(owner.cookie, "short", 0)).status).toBe(400);
    await postTree(call("POST", "/api/trees", { cookie: other.cookie, body: { tree: tree({ id: "tree-2" }) } }), t.db);
    await putPublication(call("PUT", "/api/trees/tree-2/publication", { cookie: other.cookie, body: { publicId: LINK, expectedRevision: 0 } }), t.db, "tree-2");
    expect((await publish(owner.cookie, LINK, 0)).status).toBe(409);
    expect((await (await view(LINK)).json()).snapshot.people[0].id).toBe("budi");
  });

  it("deleting the tree removes its public link", async () => {
    await publish(owner.cookie, LINK, 0);
    await removeTree(call("DELETE", "/api/trees/tree-1", { cookie: owner.cookie }), t.db, "tree-1");
    expect((await view(LINK)).status).toBe(404);
  });
});
