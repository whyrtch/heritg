import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createSession } from "@/server/auth/session";
import { createOwner } from "@/server/auth/users";
import { publications, publicPhotos } from "@/server/db/schema";
import { getPublicPersonPhoto } from "@/server/photos/handlers";
import { putPhoto } from "@/server/photos/service";
import { deletePublication, getPublicationSettings, getPublicSnapshot, putPublication } from "@/server/publications/handlers";
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

describe("link privacy options and expiry", () => {
  const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, ...new Array(50).fill(7)]);
  const withBody = (body: Record<string, unknown>, cookie = owner.cookie, treeId = "tree-1") => putPublication(call("PUT", `/api/trees/${treeId}/publication`, { cookie, body: { publicId: LINK, expectedRevision: 0, ...body } }), t.db, treeId);
  const settings = (cookie: string) => getPublicationSettings(call("GET", "/api/trees/tree-1/publication", { cookie }), t.db, "tree-1");
  const photo = (publicId = LINK) => getPublicPersonPhoto(call("GET", `/api/public/${publicId}/photos/budi`), t.db, publicId, "budi");
  const rich = () => tree({
    people: [person("budi", { birthDate: "1950-01-02", deathDate: "2020-03-04", birthOrder: 2, photoUrl: "https://example.com/a.jpg", residence: "Solo" }), person("sari")],
    relationships: [{ id: "r1", type: "partner", fromPersonId: "budi", toPersonId: "sari", kind: null, status: "married", marriedOn: "1975-05-06" }],
  });
  beforeEach(async () => {
    await removeTree(call("DELETE", "/api/trees/tree-1", { cookie: owner.cookie }), t.db, "tree-1");
    await postTree(call("POST", "/api/trees", { cookie: owner.cookie, body: { tree: rich() } }), t.db);
    await putPhoto(t.db, owner.id, "tree-1", "budi", JPEG, "image/jpeg");
  });
  const snapshotOf = async () => (await (await view(LINK)).json()).snapshot;

  it("keeps everything when no options are sent, and reports the defaults to the owner", async () => {
    expect((await withBody({})).status).toBe(200);
    const snapshot = await snapshotOf();
    expect(snapshot.people[0]).toMatchObject({ birthDate: "1950-01-02", deathDate: "2020-03-04", birthOrder: 2, photoUrl: "https://example.com/a.jpg", photoVersion: expect.any(String) });
    expect(snapshot.relationships[0].marriedOn).toBe("1975-05-06");
    expect((await photo()).status).toBe(200);
    expect((await (await settings(owner.cookie)).json()).publication).toEqual({ options: { dates: true, marriageDates: true, photos: true }, expiresAt: null, mode: "plain" });
  });

  it("dates off blanks birth, death and birth order only", async () => {
    await withBody({ options: { dates: false, marriageDates: true, photos: true } });
    const snapshot = await snapshotOf();
    expect(snapshot.people[0]).toMatchObject({ name: "BUDI", residence: "Solo", birthDate: "", deathDate: "", birthOrder: null });
    expect(snapshot.relationships[0].marriedOn).toBe("1975-05-06");
  });

  it("marriage dates off blanks marriedOn only", async () => {
    await withBody({ options: { dates: true, marriageDates: false, photos: true } });
    const snapshot = await snapshotOf();
    expect(snapshot.relationships[0]).toMatchObject({ status: "married", marriedOn: "" });
    expect(snapshot.people[0].birthDate).toBe("1950-01-02");
  });

  it("photos off removes photo fields and the public photo", async () => {
    await withBody({ options: { dates: true, marriageDates: true, photos: false } });
    expect((await snapshotOf()).people[0]).toMatchObject({ photoUrl: "", photoVersion: null });
    expect((await photo()).status).toBe(404);
    expect(await t.db.select().from(publicPhotos)).toHaveLength(0);
    expect((await (await settings(owner.cookie)).json()).publication.options.photos).toBe(false);
  });

  it("expires in the database clock: expiresInDays sets it, and an expired link looks unknown", async () => {
    await withBody({ expiresInDays: 7 });
    const { expiresAt } = (await (await settings(owner.cookie)).json()).publication;
    const days = (Date.parse(expiresAt) - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(6.9);
    expect(days).toBeLessThan(7.1);
    expect((await view(LINK)).status).toBe(200);
    expect((await photo()).status).toBe(200);
    await t.db.update(publications).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(publications.publicId, LINK));
    const unknown = "never_published_link_12345";
    const [expiredTree, unknownTree, expiredPhoto, unknownPhoto] = [await view(LINK), await view(unknown), await photo(), await photo(unknown)];
    expect(expiredTree.status).toBe(404);
    expect(await expiredTree.text()).toBe(await unknownTree.text());
    expect([...expiredTree.headers].sort()).toEqual([...unknownTree.headers].sort());
    expect(expiredPhoto.status).toBe(404);
    expect(await expiredPhoto.text()).toBe(await unknownPhoto.text());
    expect([...expiredPhoto.headers].sort()).toEqual([...unknownPhoto.headers].sort());
  });

  const stored = async () => (await (await settings(owner.cookie)).json()).publication;
  const republish = (publicId: string, expectedRevision: number, body: Record<string, unknown> = {}) => putPublication(call("PUT", "/api/trees/tree-1/publication", { cookie: owner.cookie, body: { publicId, expectedRevision, ...body } }), t.db, "tree-1");
  const NO_PHOTOS = { dates: false, marriageDates: true, photos: false };

  it("an explicit null expiry clears it", async () => {
    await withBody({ expiresInDays: 30 });
    expect((await republish(LINK, 1, { expiresInDays: null })).status).toBe(200);
    expect((await stored()).expiresAt).toBeNull();
  });

  it("an update that omits options and expiry keeps the stored ones", async () => {
    await withBody({ options: NO_PHOTOS, expiresInDays: 30 });
    const before = await stored();
    expect((await republish(LINK, 1)).status).toBe(200);
    expect(await stored()).toEqual(before);
    const snapshot = await snapshotOf();
    expect(snapshot.people[0]).toMatchObject({ birthDate: "", photoUrl: "" });
    expect((await photo()).status).toBe(404);
  });

  it("regenerating keeps the stored options and expiry unless the request sets them", async () => {
    await withBody({ options: NO_PHOTOS, expiresInDays: 30 });
    const before = await stored();
    expect((await republish(OTHER_LINK, 1)).status).toBe(200);
    expect(await stored()).toEqual(before);
    expect((await view(LINK)).status).toBe(404);
    const snapshot = (await (await view(OTHER_LINK)).json()).snapshot;
    expect(snapshot.people[0]).toMatchObject({ birthDate: "", photoUrl: "" });
    expect((await republish(LINK, 2, { options: { dates: true, marriageDates: true, photos: true } })).status).toBe(200);
    const after = await stored();
    expect(after.options).toEqual({ dates: true, marriageDates: true, photos: true });
    expect(after.expiresAt).toBe(before.expiresAt);
  });

  it("rejects invalid options and days with a 400", async () => {
    for (const body of [
      { options: { dates: "yes", marriageDates: true, photos: true } },
      { options: { dates: true, marriageDates: true } },
      { options: { dates: true, marriageDates: true, photos: true, extra: true } },
      { expiresInDays: 5 }, { expiresInDays: "7" }, { expiresInDays: 0 }, { expiresInDays: -1 },
      { surprise: 1 },
    ]) expect((await withBody(body)).status, JSON.stringify(body)).toBe(400);
    expect(await t.db.select().from(publications)).toHaveLength(0);
  });

  it("another owner cannot set options or read the settings", async () => {
    expect((await withBody({ options: { dates: false, marriageDates: false, photos: false } }, other.cookie)).status).toBe(404);
    expect((await withBody({})).status).toBe(200);
    expect((await settings(other.cookie)).status).toBe(200);
    expect((await (await settings(other.cookie)).json()).publication).toBeNull();
    expect((await settings("")).status).toBe(401);
  });

  it("never exposes the settings on the public response", async () => {
    await withBody({ expiresInDays: 90 });
    const text = await (await view(LINK)).text();
    expect(text).not.toContain("expiresAt");
    expect(text).not.toContain("marriageDates");
  });
});

describe("password-protected links", () => {
  const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, ...new Array(50).fill(7)]);
  const b64 = (length: number, fill = 1) => Buffer.from(new Uint8Array(length).fill(fill)).toString("base64");
  const envelope = (overrides: Record<string, unknown> = {}) => ({
    format: "heritg-encrypted", version: 1,
    kdf: { name: "PBKDF2", hash: "SHA-256", iterations: 600_000, salt: b64(16) },
    cipher: { name: "AES-GCM", iv: b64(12) },
    data: b64(300, 9),
    ...overrides,
  });
  const protect = (body: Record<string, unknown> = {}, cookie = owner.cookie, treeId = "tree-1") =>
    putPublication(call("PUT", `/api/trees/${treeId}/publication`, { cookie, body: { mode: "password", publicId: LINK, expectedRevision: 0, envelope: envelope(), ...body } }), t.db, treeId);
  const put = (publicId: string, expectedRevision: number, body: Record<string, unknown> = {}) =>
    putPublication(call("PUT", "/api/trees/tree-1/publication", { cookie: owner.cookie, body: { publicId, expectedRevision, ...body } }), t.db, "tree-1");
  const settings = async () => (await (await getPublicationSettings(call("GET", "/api/trees/tree-1/publication", { cookie: owner.cookie }), t.db, "tree-1")).json()).publication;
  const photo = (publicId = LINK) => getPublicPersonPhoto(call("GET", `/api/public/${publicId}/photos/budi`), t.db, publicId, "budi");
  const row = async (publicId = LINK) => (await t.db.select().from(publications).where(eq(publications.publicId, publicId)))[0];

  beforeEach(async () => {
    await removeTree(call("DELETE", "/api/trees/tree-1", { cookie: owner.cookie }), t.db, "tree-1");
    await postTree(call("POST", "/api/trees", { cookie: owner.cookie, body: { tree: tree({ people: [person("budi", { notes: "Catatan rahasia", residence: "Solo", photoUrl: "https://example.com/a.jpg" })] }) } }), t.db);
    await putPhoto(t.db, owner.id, "tree-1", "budi", JPEG, "image/jpeg");
  });

  it("stores only ciphertext: an empty snapshot, no photos, and no readable content", async () => {
    const response = await protect();
    expect(response.status).toBe(200);
    expect((await response.json()).tree).toMatchObject({ visibility: "unlisted", publicId: LINK, revision: 1, publishedRevision: 1 });
    const stored = await row();
    expect(stored).toMatchObject({ encrypted: true, snapshot: {}, name: "Keluarga Uji", ciphertext: envelope().data, publishedRevision: 1 });
    expect(stored.crypto).toEqual({ format: "heritg-encrypted", version: 1, kdf: envelope().kdf, cipher: envelope().cipher });
    expect(stored.crypto).not.toHaveProperty("data");
    const text = JSON.stringify(stored);
    for (const secret of ["BUDI", "Catatan", "Solo", "example.com"]) expect(text).not.toContain(secret);
    expect(await t.db.select().from(publicPhotos)).toHaveLength(0);
    expect((await photo()).status).toBe(404);
  });

  it("protecting removes the photo copies a plain link made, and a plain link copies them again", async () => {
    await put(LINK, 0);
    expect(await t.db.select().from(publicPhotos)).toHaveLength(1);
    expect((await protect({ expectedRevision: 1 })).status).toBe(200);
    expect(await t.db.select().from(publicPhotos)).toHaveLength(0);
    expect((await photo()).status).toBe(404);
    expect((await put(LINK, 2, { mode: "plain" })).status).toBe(200);
    expect((await photo()).status).toBe(200);
  });

  it("the database refuses mixed rows", async () => {
    await put(LINK, 0);
    const bad = (statement: string) => expect(t.client.query(statement), statement).rejects.toThrow();
    await bad("update publications set encrypted = true");
    await bad("update publications set ciphertext = 'AAAA'");
    await bad("update publications set crypto = '{}'::jsonb");
    await bad("update publications set encrypted = true, ciphertext = 'AAAA', crypto = '{}'::jsonb");
    await protect({ publicId: OTHER_LINK, expectedRevision: 1 });
    await bad(`update publications set snapshot = '{"people":[]}'::jsonb where encrypted`);
    await bad("update publications set ciphertext = null where encrypted");
    await bad("update publications set crypto = null where encrypted");
    await bad("update publications set crypto = '[]'::jsonb where encrypted");
    await bad("update publications set encrypted = false where encrypted");
    await bad("update publications set ciphertext = repeat('A', 4000001) where encrypted");
    await expect(t.client.query("update publications set ciphertext = repeat('A', 4000000) where encrypted")).resolves.toBeTruthy();
  });

  it("rejects an invalid envelope or mode combination with a 400", async () => {
    const e = envelope();
    const cases: Record<string, unknown>[] = [
      { envelope: undefined }, { envelope: null }, { envelope: "text" },
      { envelope: { ...e, format: "other" } }, { envelope: { ...e, version: 2 } }, { envelope: { ...e, extra: 1 } },
      { envelope: { ...e, kdf: { ...e.kdf, name: "scrypt" } } }, { envelope: { ...e, kdf: { ...e.kdf, hash: "SHA-1" } } },
      { envelope: { ...e, kdf: { ...e.kdf, iterations: 99_999 } } }, { envelope: { ...e, kdf: { ...e.kdf, iterations: 5_000_001 } } },
      { envelope: { ...e, kdf: { ...e.kdf, iterations: 600_000.5 } } }, { envelope: { ...e, kdf: { ...e.kdf, iterations: "600000" } } },
      { envelope: { ...e, kdf: { ...e.kdf, salt: b64(15) } } }, { envelope: { ...e, kdf: { ...e.kdf, salt: "not base64!" } } },
      { envelope: { ...e, kdf: { ...e.kdf, extra: 1 } } },
      { envelope: { ...e, cipher: { ...e.cipher, name: "AES-CBC" } } }, { envelope: { ...e, cipher: { ...e.cipher, iv: b64(16) } } },
      { envelope: { ...e, data: "" } }, { envelope: { ...e, data: "AAAA" } }, { envelope: { ...e, data: "abc" } }, { envelope: { ...e, data: "<script>" } },
      { envelope: { ...e, data: "A".repeat(4_000_004) } },
      { envelope: { ...e, data: 5 } },
      { surprise: 1 }, { options: { dates: "x", marriageDates: true, photos: true } }, { expiresInDays: 5 },
    ];
    for (const body of cases) expect((await protect(body)).status, JSON.stringify(body).slice(0, 120)).toBe(400);
    expect((await put(LINK, 0, { envelope: envelope() })).status).toBe(400);
    expect((await put(LINK, 0, { mode: "other" })).status).toBe(400);
    expect(await t.db.select().from(publications)).toHaveLength(0);
  });

  it("limits the request body: password mode up to about 4.5 MB, every other mode as before", async () => {
    // The largest ciphertext the database allows fits in a body this big.
    expect((await protect({ envelope: envelope({ data: "A".repeat(4_000_000) }) })).status).toBe(200);
    expect((await protect({ expectedRevision: 1, envelope: envelope({ data: "A".repeat(4_600_000) }) })).status).toBe(413);
    expect((await put(LINK, 1, { expiresInDays: 7, padding: "x".repeat(2000) })).status).toBe(413);
    expect((await put(LINK, 1, { padding: "x".repeat(5_000_000) })).status).toBe(413);
    expect((await row()).publishedRevision).toBe(1);
  });

  it("only the signed-in owner can protect a tree; the origin is checked", async () => {
    expect((await protect({}, "")).status).toBe(401);
    expect((await protect({}, other.cookie)).status).toBe(404);
    expect((await putPublication(call("PUT", "/api/trees/tree-1/publication", { cookie: owner.cookie, origin: "https://evil.example", body: { mode: "password", publicId: LINK, expectedRevision: 0, envelope: envelope() } }), t.db, "tree-1")).status).toBe(403);
    expect(await t.db.select().from(publications)).toHaveLength(0);
    expect((await protect({ expectedRevision: 5 })).status).toBe(409);
  });

  it("serves the envelope and the name to anyone with the link, with the same headers", async () => {
    await protect();
    const response = await view(LINK);
    expect(response.status).toBe(200);
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    const text = await response.text();
    expect(JSON.parse(text)).toEqual({ encrypted: true, name: "Keluarga Uji", envelope: envelope() });
    for (const secret of [owner.id, owner.email, "ownerId", "tree-1", "BUDI", "Catatan", "expiresAt", "marriageDates"]) expect(text).not.toContain(secret);
  });

  it("an expired protected link looks exactly like an unknown one", async () => {
    await protect({ expiresInDays: 7 });
    expect((await view(LINK)).status).toBe(200);
    await t.db.update(publications).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(publications.publicId, LINK));
    const unknown = "never_published_link_12345";
    const [expired, missing] = [await view(LINK), await view(unknown)];
    expect(expired.status).toBe(404);
    expect(await expired.text()).toBe(await missing.text());
    expect([...expired.headers].sort()).toEqual([...missing.headers].sort());
  });

  it("tells the owner the mode, and an omitted expiry keeps the stored one", async () => {
    expect(await settings()).toBeNull();
    await protect({ expiresInDays: 30 });
    const before = await settings();
    expect(before).toMatchObject({ mode: "password", options: { dates: true, marriageDates: true, photos: true } });
    expect(before.expiresAt).not.toBeNull();
    await protect({ expectedRevision: 1, envelope: envelope({ data: b64(400, 3) }) });
    expect(await settings()).toEqual(before);
    await protect({ expectedRevision: 2, expiresInDays: null, options: { dates: false, marriageDates: false, photos: false } });
    expect(await settings()).toEqual({ mode: "password", expiresAt: null, options: { dates: false, marriageDates: false, photos: false } });
  });

  it("switches password -> plain -> password", async () => {
    await protect();
    expect((await put(LINK, 1, { mode: "plain" })).status).toBe(200);
    expect(await row()).toMatchObject({ encrypted: false, ciphertext: null, crypto: null });
    expect((await (await view(LINK)).json()).snapshot.people[0]).toMatchObject({ name: "BUDI", notes: "Catatan rahasia" });
    expect((await settings()).mode).toBe("plain");
    expect((await protect({ expectedRevision: 2, envelope: envelope({ data: b64(64, 5) }) })).status).toBe(200);
    const text = await (await view(LINK)).text();
    expect(JSON.parse(text)).toMatchObject({ encrypted: true, envelope: { data: b64(64, 5) } });
    expect(text).not.toContain("Catatan");
    expect(await row()).toMatchObject({ encrypted: true, snapshot: {} });
    expect(await t.db.select().from(publicPhotos)).toHaveLength(0);
  });

  it("regenerating keeps a protected link protected: the ciphertext moves to the new id and the old URL dies", async () => {
    await protect({ expiresInDays: 30 });
    const before = await settings();
    expect((await put(OTHER_LINK, 1)).status).toBe(200);
    expect((await view(LINK)).status).toBe(404);
    expect(await t.db.select().from(publications)).toHaveLength(1);
    expect(JSON.parse(await (await view(OTHER_LINK)).text())).toEqual({ encrypted: true, name: "Keluarga Uji", envelope: envelope() });
    expect(await row(OTHER_LINK)).toMatchObject({ encrypted: true, snapshot: {} });
    expect(await settings()).toEqual(before);
  });

  it("a request without a mode never turns a protected link into a readable one", async () => {
    await protect();
    expect((await put(LINK, 1, { expiresInDays: 7 })).status).toBe(200);
    expect(await row()).toMatchObject({ encrypted: true, snapshot: {} });
    expect((await (await view(LINK)).json()).encrypted).toBe(true);
    expect(await t.db.select().from(publicPhotos)).toHaveLength(0);
  });

  it("regenerating a protected link keeps its options and published revision", async () => {
    const options = { dates: false, marriageDates: true, photos: false };
    await protect({ options });
    const before = await row();
    expect((await put(OTHER_LINK, 1, { expiresInDays: 30 })).status).toBe(200);
    const after = await row(OTHER_LINK);
    expect(after).toMatchObject({ options, publishedRevision: 1, encrypted: true });
    expect(after.publishedAt).toEqual(before.publishedAt);
    expect((await settings()).options).toEqual(options);
    expect((await (await put(OTHER_LINK, 2, { expiresInDays: null })).json()).tree).toMatchObject({ publicId: OTHER_LINK, publishedRevision: 1, revision: 3 });
  });

  it("refuses options without a new envelope on a protected link, and changes nothing", async () => {
    await protect({ options: { dates: false, marriageDates: true, photos: false } });
    const before = await row();
    for (const publicId of [LINK, OTHER_LINK]) {
      const response = await put(publicId, 1, { options: { dates: true, marriageDates: true, photos: true } });
      expect(response.status).toBe(409);
      expect((await response.json()).error.message).toMatch(/password/);
    }
    expect(await t.db.select().from(publications)).toEqual([before]);
    expect((await view(LINK)).status).toBe(200);
    // With a new envelope the options do change.
    expect((await protect({ expectedRevision: 1, options: { dates: true, marriageDates: true, photos: true } })).status).toBe(200);
    expect((await settings()).options).toEqual({ dates: true, marriageDates: true, photos: true });
  });

  it("revoking a protected link deletes it", async () => {
    await protect();
    expect((await unpublish(owner.cookie)).status).toBe(200);
    expect((await view(LINK)).status).toBe(404);
    expect(await t.db.select().from(publications)).toHaveLength(0);
  });
});
