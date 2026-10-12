import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createSession } from "@/server/auth/session";
import { createOwner } from "@/server/auth/users";
import { deletePersonPhoto, getPersonPhoto, getPublicPersonPhoto, putPersonPhoto } from "@/server/photos/handlers";
import { deletePublication, putPublication } from "@/server/publications/handlers";
import { getTree, postTree, putTree } from "@/server/trees/handlers";
import { createTestDb, type TestDb } from "./db";

const ORIGIN = "http://localhost:3000", LINK = "public_identifier_photos_1234";
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, ...new Array(200).fill(7)]);
const WEBP = new Uint8Array([...new TextEncoder().encode("RIFF"), 0, 0, 0, 0, ...new TextEncoder().encode("WEBPVP8 "), ...new Array(100).fill(1)]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...new Array(100).fill(0)]);
let t: TestDb;
let owner: { cookie: string }, other: { cookie: string };

async function account(email: string) {
  const { id } = await createOwner(t.db, email, "correct horse battery");
  return { cookie: `__Host-heritg_session=${(await createSession(t.db, id)).token}` };
}
function call(method: string, path: string, { cookie, body, type, origin = ORIGIN, headers = {} }: { cookie?: string; body?: BodyInit; type?: string; origin?: string; headers?: Record<string, string> } = {}): Request {
  const all = new Headers({ origin, ...headers });
  if (cookie) all.set("cookie", cookie);
  if (type) all.set("content-type", type);
  return new Request(`${ORIGIN}${path}`, { method, headers: all, body });
}
const person = (id: string) => ({ id, name: id.toUpperCase(), gender: "unspecified", birthDate: "", deathDate: "", birthOrder: null, residence: "", notes: "", photoUrl: "", sortOrder: 0 });
const tree = (people = [person("budi"), person("sari")]) => ({ id: "tree-1", name: "Keluarga Uji", schemaVersion: 2, people, relationships: [] });
const upload = (cookie: string, bytes: Uint8Array, type = "image/jpeg", personId = "budi", origin = ORIGIN) => putPersonPhoto(call("PUT", `/api/trees/tree-1/people/${personId}/photo`, { cookie, body: bytes as unknown as BodyInit, type, origin }), t.db, "tree-1", personId);
const download = (cookie: string, headers: Record<string, string> = {}) => getPersonPhoto(call("GET", "/api/trees/tree-1/people/budi/photo", { cookie, headers }), t.db, "tree-1", "budi");
const loadPeople = async (cookie: string) => (await (await getTree(call("GET", "/api/trees/tree-1", { cookie }), t.db, "tree-1")).json()).tree.people as { id: string; photoVersion: string | null }[];
const save = (cookie: string, body: ReturnType<typeof tree>, expectedRevision: number) => putTree(call("PUT", "/api/trees/tree-1", { cookie, body: JSON.stringify({ tree: body, expectedRevision }), type: "application/json" }), t.db, "tree-1");

beforeAll(async () => { process.env.APP_URL = ORIGIN; t = await createTestDb(); });
afterAll(async () => { await t.close(); });
beforeEach(async () => {
  await t.client.exec("truncate users, login_attempts cascade");
  owner = await account("owner@heritg.test");
  other = await account("other@heritg.test");
  await postTree(call("POST", "/api/trees", { cookie: owner.cookie, body: JSON.stringify({ tree: tree() }), type: "application/json" }), t.db);
});

describe("person photos", () => {
  it("stores a JPEG or WebP thumbnail and reports its version on the tree", async () => {
    const response = await upload(owner.cookie, JPEG);
    expect(response.status).toBe(200);
    const { photoVersion } = await response.json();
    expect(photoVersion).toMatch(/^[0-9a-f]{16}$/);
    expect((await loadPeople(owner.cookie)).find(item => item.id === "budi")?.photoVersion).toBe(photoVersion);
    expect((await loadPeople(owner.cookie)).find(item => item.id === "sari")?.photoVersion).toBeNull();
    expect((await upload(owner.cookie, WEBP, "image/webp", "sari")).status).toBe(200);
  });

  it("serves photos only to the owner, with safe, cacheable headers", async () => {
    await upload(owner.cookie, JPEG);
    const response = await download(owner.cookie);
    expect(response.status).toBe(200);
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(JPEG);
    expect(response.headers.get("content-type")).toBe("image/jpeg");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("content-security-policy")).toContain("default-src 'none'");
    expect(response.headers.get("cache-control")).toBe("private, max-age=31536000, immutable");
    expect((await download(owner.cookie, { "if-none-match": response.headers.get("etag")! })).status).toBe(304);
    expect((await download(other.cookie)).status).toBe(404);
    expect((await download("")).status).toBe(401);
  });

  it("rejects other image types, lies about the type, oversize files and unknown people", async () => {
    expect((await upload(owner.cookie, PNG, "image/png")).status).toBe(415);
    expect((await upload(owner.cookie, PNG, "image/jpeg")).status).toBe(400);
    expect((await upload(owner.cookie, new TextEncoder().encode("<svg onload=alert(1)>"), "image/jpeg")).status).toBe(400);
    expect((await upload(owner.cookie, WEBP, "image/jpeg")).status).toBe(400);
    const big = new Uint8Array(49153); big.set([0xff, 0xd8, 0xff]);
    expect((await upload(owner.cookie, big)).status).toBe(413);
    expect((await upload(owner.cookie, JPEG, "image/jpeg", "nobody")).status).toBe(404);
  });

  it("only lets the owner upload or delete, from the app's origin", async () => {
    expect((await upload("", JPEG)).status).toBe(401);
    expect((await upload(other.cookie, JPEG)).status).toBe(404);
    expect((await upload(owner.cookie, JPEG, "image/jpeg", "budi", "https://evil.example")).status).toBe(403);
    await upload(owner.cookie, JPEG);
    expect((await deletePersonPhoto(call("DELETE", "/api/trees/tree-1/people/budi/photo", { cookie: other.cookie }), t.db, "tree-1", "budi")).status).toBe(404);
    expect((await deletePersonPhoto(call("DELETE", "/api/trees/tree-1/people/budi/photo", { cookie: owner.cookie }), t.db, "tree-1", "budi")).status).toBe(200);
    expect((await loadPeople(owner.cookie)).find(item => item.id === "budi")?.photoVersion).toBeNull();
  });

  it("is untouched by tree saves, and removed with its person", async () => {
    await upload(owner.cookie, JPEG);
    // A save never carries photos (even with photoVersion null), so it cannot delete one by accident.
    expect((await save(owner.cookie, tree([{ ...person("budi"), name: "Budi Baru" }, person("sari")]), 0)).status).toBe(200);
    expect((await loadPeople(owner.cookie)).find(item => item.id === "budi")?.photoVersion).not.toBeNull();
    await save(owner.cookie, tree([person("sari")]), 1);
    expect((await download(owner.cookie)).status).toBe(404);
  });
});

describe("public photos", () => {
  const publicPhoto = (personId = "budi") => getPublicPersonPhoto(call("GET", `/api/public/${LINK}/photos/${personId}`), t.db, LINK, personId);
  const publish = (expectedRevision: number) => putPublication(call("PUT", "/api/trees/tree-1/publication", { cookie: owner.cookie, body: JSON.stringify({ publicId: LINK, expectedRevision }), type: "application/json" }), t.db, "tree-1");

  it("are copied when publishing, served only while the link is enabled, and must be revalidated", async () => {
    await upload(owner.cookie, JPEG);
    expect((await publicPhoto()).status).toBe(404);
    await publish(0);
    const response = await publicPhoto();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-cache");
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    expect((await publicPhoto("sari")).status).toBe(404);
    await deletePublication(call("DELETE", "/api/trees/tree-1/publication", { cookie: owner.cookie, body: JSON.stringify({ expectedRevision: 1 }), type: "application/json" }), t.db, "tree-1");
    expect((await publicPhoto()).status).toBe(404);
  });

  it("stay frozen until the owner republishes", async () => {
    await upload(owner.cookie, JPEG);
    await publish(0);
    await deletePersonPhoto(call("DELETE", "/api/trees/tree-1/people/budi/photo", { cookie: owner.cookie }), t.db, "tree-1", "budi");
    expect((await publicPhoto()).status).toBe(200);
    await publish(1);
    expect((await publicPhoto()).status).toBe(404);
  });
});
