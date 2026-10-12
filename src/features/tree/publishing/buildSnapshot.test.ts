import { describe, expect, it, vi } from "vitest";
import type { OnlineTree } from "../domain/onlineTypes";
import { decryptText, WrongPasswordError } from "../domain/secureFile";
import { buildSnapshot, encryptSnapshot, fetchPhotoDataUrls, LINK_CIPHERTEXT_MAX_CHARS, SnapshotTooLargeError } from "./buildSnapshot";
import { DamagedSnapshotError, openProtected } from "./openProtected";
import type { EncryptedPublicTree } from "./PublicationRepository";

const AT = "2026-01-01T00:00:00.000Z";
const person = (id: string, extra: Record<string, unknown> = {}) => ({ id, name: id.toUpperCase(), gender: "male" as const, birthDate: "", deathDate: "", birthOrder: null, residence: "", notes: "", photoUrl: "", photoVersion: null, sortOrder: 0, updatedAt: AT, ...extra });
const tree: OnlineTree = {
  id: "tree-1", ownerId: "owner-secret-id", name: "Keluarga Uji", visibility: "private", publicId: null, revision: 3, schemaVersion: 2, createdAt: AT, updatedAt: AT, publishedRevision: null,
  people: [
    person("budi", { birthDate: "1950-01-02", deathDate: "2020-03-04", birthOrder: 2, photoUrl: "https://example.com/a.jpg", photoVersion: "0123456789abcdef", notes: "Catatan" }),
    person("sari", { photoVersion: "fedcba9876543210" }),
  ],
  relationships: [{ id: "r1", type: "partner", fromPersonId: "budi", toPersonId: "sari", kind: null, status: "married", marriedOn: "1975-05-06", updatedAt: AT }],
};
const ALL = { dates: true, marriageDates: true, photos: true };
const DATA = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ==";

describe("buildSnapshot", () => {
  it("has the public snapshot shape and no owner data", () => {
    const snapshot = buildSnapshot(tree, ALL);
    const text = JSON.stringify(snapshot);
    for (const secret of ["owner-secret-id", "ownerId", "updatedAt", "tree-1", "visibility"]) expect(text).not.toContain(secret);
    expect(snapshot.people[0]).toMatchObject({ id: "budi", name: "BUDI", birthDate: "1950-01-02", deathDate: "2020-03-04", birthOrder: 2, notes: "Catatan", photoUrl: "https://example.com/a.jpg", photoVersion: null });
    expect(snapshot.relationships[0]).toMatchObject({ id: "r1", fromPersonId: "budi", marriedOn: "1975-05-06" });
  });

  it("dates off blanks birth, death and birth order only", () => {
    const { people, relationships } = buildSnapshot(tree, { ...ALL, dates: false });
    expect(people[0]).toMatchObject({ name: "BUDI", birthDate: "", deathDate: "", birthOrder: null, photoUrl: "https://example.com/a.jpg" });
    expect(relationships[0].marriedOn).toBe("1975-05-06");
  });

  it("marriage dates off blanks marriedOn only", () => {
    const { people, relationships } = buildSnapshot(tree, { ...ALL, marriageDates: false });
    expect(relationships[0]).toMatchObject({ status: "married", marriedOn: "" });
    expect(people[0].birthDate).toBe("1950-01-02");
  });

  it("photos off drops photo links and embedded photos; photos on embeds only valid data URLs", () => {
    const withPhotos = buildSnapshot(tree, ALL, { budi: DATA, sari: "https://evil.example/x.png", ghost: DATA });
    expect(withPhotos.photos).toEqual({ budi: DATA });
    const without = buildSnapshot(tree, { ...ALL, photos: false }, { budi: DATA });
    expect(without.people[0]).toMatchObject({ photoUrl: "", photoVersion: null });
    expect(without).not.toHaveProperty("photos");
  });
});

describe("fetchPhotoDataUrls", () => {
  it("fetches uploaded thumbnails with credentials and skips failures", async () => {
    const jpeg = () => new Response(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]), { headers: { "Content-Type": "image/jpeg" } });
    const fetchImpl = vi.fn(async (url: RequestInfo | URL) => String(url).includes("/people/budi/") ? jpeg() : new Response("no", { status: 404 }));
    const found = await fetchPhotoDataUrls(tree, fetchImpl as unknown as typeof fetch);
    expect(Object.keys(found)).toEqual(["budi"]);
    expect(found.budi).toMatch(/^data:image\/jpeg;base64,/);
    expect(fetchImpl).toHaveBeenCalledWith("/api/trees/tree-1/people/budi/photo?v=0123456789abcdef", { credentials: "same-origin" });
  });
});

describe("encryptSnapshot / openProtected", () => {
  const PASSWORD = "Sandi#Kuat1";
  const noPhotos = vi.fn(async () => new Response("no", { status: 404 })) as unknown as typeof fetch;
  const link = (envelope: EncryptedPublicTree["envelope"]): EncryptedPublicTree => ({ encrypted: true, publicId: "public_identifier_abcdefghij", name: "Keluarga Uji", envelope });

  it("encrypts in the browser: the envelope holds no readable names and the password opens it", async () => {
    const envelope = await encryptSnapshot(tree, ALL, PASSWORD, { fetchImpl: noPhotos, iterations: 100_000 });
    const text = JSON.stringify(envelope);
    for (const readable of ["BUDI", "Catatan", "Keluarga", PASSWORD]) expect(text).not.toContain(readable);
    const opened = await openProtected(link(envelope), PASSWORD);
    expect(opened.name).toBe("Keluarga Uji");
    expect(opened.tree.people.map(item => item.name)).toEqual(["BUDI", "SARI"]);
    expect(opened.tree.people[0]).toMatchObject({ birthDate: "1950-01-02", notes: "Catatan", photoUrl: "https://example.com/a.jpg" });
    expect(opened.tree.relationships[0]).toMatchObject({ type: "partner", from: "budi", to: "sari", marriedOn: "1975-05-06" });
  });

  it("honours the options before encrypting and embeds fetched thumbnails", async () => {
    const jpeg = () => new Response(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]), { headers: { "Content-Type": "image/jpeg" } });
    const fetchImpl = (async () => jpeg()) as unknown as typeof fetch;
    const strict = await encryptSnapshot(tree, { dates: false, marriageDates: false, photos: false }, PASSWORD, { fetchImpl, iterations: 100_000 });
    const plain = JSON.parse(await decryptText(strict, PASSWORD));
    expect(plain.people[0]).toMatchObject({ birthDate: "", photoUrl: "" });
    expect(plain.relationships[0].marriedOn).toBe("");
    expect(plain.photos).toBeUndefined();
    const rich = await openProtected(link(await encryptSnapshot(tree, ALL, PASSWORD, { fetchImpl, iterations: 100_000 })), PASSWORD);
    expect(rich.tree.people[0].photo).toMatch(/^data:image\/jpeg;base64,/);
  });

  it("a wrong password fails, and so does damaged content", async () => {
    const envelope = await encryptSnapshot(tree, ALL, PASSWORD, { fetchImpl: noPhotos, iterations: 100_000 });
    await expect(openProtected(link(envelope), "Salah#Sandi9")).rejects.toBeInstanceOf(WrongPasswordError);
    const { encryptText } = await import("../domain/secureFile");
    for (const body of ["not json", JSON.stringify({ people: [] }), JSON.stringify({ people: [{ id: "x" }], relationships: [] })]) {
      await expect(openProtected(link(await encryptText(body, PASSWORD, { iterations: 100_000 })), PASSWORD)).rejects.toBeInstanceOf(DamagedSnapshotError);
    }
  });

  it("refuses a tree whose ciphertext would exceed the server cap", async () => {
    const huge: OnlineTree = { ...tree, people: [person("big", { notes: "x".repeat(Math.ceil(LINK_CIPHERTEXT_MAX_CHARS * 0.76)) })] };
    await expect(encryptSnapshot(huge, ALL, PASSWORD, { fetchImpl: noPhotos, iterations: 100_000 })).rejects.toBeInstanceOf(SnapshotTooLargeError);
  });
});
