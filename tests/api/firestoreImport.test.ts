import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createOwner } from "@/server/auth/users";
import { publications, trees } from "@/server/db/schema";
import { importFirestoreExport, type FirestoreExport } from "@/server/migration/firestoreImport";
import { loadPublicSnapshot, unpublishTree } from "@/server/publications/service";
import { loadTree, saveTree } from "@/server/trees/service";
import { createTestDb, type TestDb } from "./db";

let t: TestDb;
let ownerId: string, otherId: string;
const at = "2025-03-01T10:00:00.000Z";
const PUBLIC_ID = "firebase_public_link_123456";

/** Shaped like scripts/firestore-reader.ts output: v1 documents, timestamps as ISO strings. */
const exportFixture = (): FirestoreExport => ({
  exportedAt: at, ownerUid: "firebase-uid",
  trees: [
    {
      id: "tree-v1", data: { ownerId: "firebase-uid", name: "Keluarga Lama", visibility: "unlisted", publicId: PUBLIC_ID, revision: 7, schemaVersion: 1, createdAt: "2024-01-01T00:00:00.000Z", updatedAt: at, publishedRevision: 5 },
      people: [
        { id: "budi", data: { firstName: "Budi", lastName: "Santoso", gender: "male", birthDate: "1960-02-03", deathDate: "", notes: "Kakek", photoUrl: "https://example.com/budi.jpg", sortOrder: 0, updatedAt: at } },
        { id: "sari", data: { firstName: "Sari", lastName: "", gender: "nonbinary", birthDate: "", deathDate: "", notes: "", photoUrl: "", sortOrder: 1, updatedAt: at } },
        { id: "rahasia", data: { firstName: "Ditambah", lastName: "Setelah Publish", gender: "unspecified", birthDate: "", deathDate: "", notes: "privat", photoUrl: "", sortOrder: 2, updatedAt: at } },
      ],
      relationships: [{ id: "r1", data: { type: "partner", fromPersonId: "budi", toPersonId: "sari", updatedAt: at } }, { id: "r2", data: { type: "parent-child", fromPersonId: "budi", toPersonId: "rahasia", updatedAt: at } }],
      // The public copy was published before "rahasia" was added; it must stay that way.
      publication: {
        id: PUBLIC_ID, data: { sourceTreeId: "tree-v1", name: "Keluarga Lama", enabled: true, schemaVersion: 1, publishedRevision: 5, publishedAt: "2025-02-01T00:00:00.000Z" },
        people: [
          { id: "budi", data: { firstName: "Budi", lastName: "Santoso", gender: "male", birthDate: "1960-02-03", deathDate: "", notes: "Kakek", photoUrl: "", sortOrder: 0, updatedAt: at } },
          { id: "sari", data: { firstName: "Sari", lastName: "", gender: "female", birthDate: "", deathDate: "", notes: "", photoUrl: "", sortOrder: 1, updatedAt: at } },
        ],
        relationships: [{ id: "r1", data: { type: "partner", fromPersonId: "budi", toPersonId: "sari", updatedAt: at } }],
      },
    },
    {
      id: "tree-v2", data: { ownerId: "firebase-uid", name: "Keluarga Baru", visibility: "private", publicId: null, revision: 2, schemaVersion: 2, createdAt: at, updatedAt: at, publishedRevision: null },
      people: [{ id: "ani", data: { name: "Ani", gender: "female", birthDate: "", deathDate: "", birthOrder: 1, residence: "Solo", notes: "", photoUrl: "", sortOrder: 0, updatedAt: at } }],
      relationships: [],
    },
    { id: "tree-broken", data: { ownerId: "firebase-uid", name: "", revision: 0, schemaVersion: 2, createdAt: at, updatedAt: at, visibility: "private", publicId: null, publishedRevision: null }, people: [], relationships: [] },
  ],
});

beforeAll(async () => { t = await createTestDb(); });
afterAll(async () => { await t.close(); });
beforeEach(async () => {
  await t.client.exec("truncate users, login_attempts cascade");
  ({ id: ownerId } = await createOwner(t.db, "owner@heritg.test", "correct horse battery"));
  ({ id: otherId } = await createOwner(t.db, "other@heritg.test", "correct horse battery"));
});

describe("Firestore import", () => {
  it("validates and reports in a dry run without writing anything", async () => {
    const outcomes = await importFirestoreExport(t.db, ownerId, exportFixture(), { dryRun: true, overwrite: false });
    expect(outcomes.map(outcome => [outcome.treeId, outcome.result, outcome.publication])).toEqual([["tree-v1", "would-create", "would-restore"], ["tree-v2", "would-create", "none"], ["tree-broken", "failed", "none"]]);
    expect(outcomes[2].problems[0]).toMatch(/name/);
    expect(await t.db.select().from(trees)).toHaveLength(0);
  });

  it("imports v1 and v2 trees for the owner, upgrading old documents", async () => {
    const outcomes = await importFirestoreExport(t.db, ownerId, exportFixture(), { dryRun: false, overwrite: false });
    expect(outcomes.map(outcome => outcome.result)).toEqual(["created", "created", "failed"]);
    const old = await loadTree(t.db, ownerId, "tree-v1");
    expect(old.people.map(person => [person.name, person.gender])).toEqual([["Budi Santoso", "male"], ["Sari", "unspecified"], ["Ditambah Setelah Publish", "unspecified"]]);
    expect(old.relationships.find(item => item.id === "r1")).toMatchObject({ kind: null, status: "married" });
    expect(old.relationships.find(item => item.id === "r2")).toMatchObject({ kind: "biological" });
    expect(old.createdAt).toBe("2024-01-01T00:00:00.000Z");
    expect((await loadTree(t.db, ownerId, "tree-v2")).people[0]).toMatchObject({ name: "Ani", birthOrder: 1, residence: "Solo" });
  });

  it("restores the public link with the same id and only what was published", async () => {
    await importFirestoreExport(t.db, ownerId, exportFixture(), { dryRun: false, overwrite: false });
    const tree = await loadTree(t.db, ownerId, "tree-v1");
    expect(tree).toMatchObject({ visibility: "unlisted", publicId: PUBLIC_ID });
    const snapshot = await loadPublicSnapshot(t.db, PUBLIC_ID);
    expect(snapshot?.people.map(person => person.name)).toEqual(["Budi Santoso", "Sari"]);
    expect(JSON.stringify(snapshot)).not.toContain("privat");
  });

  it("never clobbers trees on a re-run unless asked to overwrite", async () => {
    await importFirestoreExport(t.db, ownerId, exportFixture(), { dryRun: false, overwrite: false });
    const current = await loadTree(t.db, ownerId, "tree-v2");
    await saveTree(t.db, ownerId, { id: "tree-v2", name: "Diedit di backend baru", schemaVersion: 2, people: current.people.map(({ updatedAt: _u, photoVersion: _p, ...person }) => { void _u; void _p; return person; }), relationships: [] }, current.revision);
    const rerun = await importFirestoreExport(t.db, ownerId, exportFixture(), { dryRun: false, overwrite: false });
    expect(rerun.map(outcome => outcome.result)).toEqual(["skipped-existing", "skipped-existing", "failed"]);
    expect((await loadTree(t.db, ownerId, "tree-v2")).name).toBe("Diedit di backend baru");
    expect(await t.db.select().from(publications)).toHaveLength(1);
    const forced = await importFirestoreExport(t.db, ownerId, exportFixture(), { dryRun: false, overwrite: true });
    expect(forced.map(outcome => outcome.result)).toEqual(["overwritten", "overwritten", "failed"]);
    expect((await loadTree(t.db, ownerId, "tree-v2")).name).toBe("Keluarga Baru");
    expect(await t.db.select().from(publications)).toHaveLength(1);
  });

  it("refuses a tree id that belongs to another account", async () => {
    await importFirestoreExport(t.db, otherId, exportFixture(), { dryRun: false, overwrite: false });
    const outcomes = await importFirestoreExport(t.db, ownerId, exportFixture(), { dryRun: false, overwrite: true });
    expect(outcomes[0]).toMatchObject({ result: "failed", problems: [expect.stringMatching(/another account/)] });
    expect((await loadTree(t.db, otherId, "tree-v1")).name).toBe("Keluarga Lama");
  });

  it("reports a link that could not be restored, and restores it on a later run", async () => {
    const data = exportFixture();
    data.trees[0].publication!.people[0].data.photoUrl = "http://not-https.example/budi.jpg";
    const first = await importFirestoreExport(t.db, ownerId, data, { dryRun: false, overwrite: false });
    expect(first[0]).toMatchObject({ result: "created", publication: "failed" });
    expect(await loadPublicSnapshot(t.db, PUBLIC_ID)).toBeNull();
    const fixed = await importFirestoreExport(t.db, ownerId, exportFixture(), { dryRun: false, overwrite: false });
    expect(fixed[0]).toMatchObject({ result: "skipped-existing", publication: "restored" });
    expect((await loadPublicSnapshot(t.db, PUBLIC_ID))?.people).toHaveLength(2);
  });

  it("never replaces a public link already made on the new backend", async () => {
    await importFirestoreExport(t.db, ownerId, exportFixture(), { dryRun: false, overwrite: false });
    const overwrite = await importFirestoreExport(t.db, ownerId, exportFixture(), { dryRun: false, overwrite: true });
    expect(overwrite[0]).toMatchObject({ result: "overwritten", publication: "kept" });
    expect(await t.db.select().from(publications)).toHaveLength(1);
  });

  it("never brings back a link the owner revoked on the new backend", async () => {
    await importFirestoreExport(t.db, ownerId, exportFixture(), { dryRun: false, overwrite: false });
    const tree = await loadTree(t.db, ownerId, "tree-v1");
    await unpublishTree(t.db, ownerId, "tree-v1", tree.revision);
    for (const overwrite of [false, true]) {
      const outcomes = await importFirestoreExport(t.db, ownerId, exportFixture(), { dryRun: false, overwrite });
      expect(outcomes[0].publication).toBe("kept");
      expect(await loadPublicSnapshot(t.db, PUBLIC_ID)).toBeNull();
    }
    expect((await loadTree(t.db, ownerId, "tree-v1")).visibility).toBe("private");
  });

  it("rejects an export file that is not in the expected shape before writing anything", async () => {
    await expect(importFirestoreExport(t.db, ownerId, { exportedAt: at, ownerUid: "x", trees: [{ id: "t", data: {}, people: "nope" }] } as never, { dryRun: false, overwrite: false })).rejects.toThrow(/expected shape/);
    expect(await t.db.select().from(trees)).toHaveLength(0);
  });

  it("skips disabled public links", async () => {
    const data = exportFixture();
    data.trees[0].publication!.data.enabled = false;
    await importFirestoreExport(t.db, ownerId, data, { dryRun: false, overwrite: false });
    expect(await loadPublicSnapshot(t.db, PUBLIC_ID)).toBeNull();
    expect((await loadTree(t.db, ownerId, "tree-v1")).visibility).toBe("private");
  });
});
