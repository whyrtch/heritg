import { describe, expect, it } from "vitest";
import { createJokowiDemoTree } from "../demoData";
import { toOnlineTree } from "../domain/serialization";
import { LEGACY_WORKSPACE_STORAGE_KEY, LocalTreeCache, TREE_CACHE_STORAGE_KEY } from "./LocalTreeCache";

class MemoryStorage {
  private values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

describe("LocalTreeCache", () => {
  it("loads legacy workspace data without deleting it", () => {
    const storage = new MemoryStorage();
    const workspace = { version: 1 as const, activeTreeId: "legacy", trees: [{ ...createJokowiDemoTree(), id: "legacy" }] };
    storage.setItem(LEGACY_WORKSPACE_STORAGE_KEY, JSON.stringify(workspace));
    expect(new LocalTreeCache(storage).loadWorkspace()).toEqual(workspace);
    expect(storage.getItem(LEGACY_WORKSPACE_STORAGE_KEY)).toBeTruthy();
  });

  it("persists snapshots and ordered pending operations", () => {
    const storage = new MemoryStorage();
    const cache = new LocalTreeCache(storage);
    const serialized = toOnlineTree(createJokowiDemoTree(), { ownerId: "owner", revision: 2 });
    const { excludedDataUrlPhotoIds: _excludedDataUrlPhotoIds, ...tree } = serialized;
    void _excludedDataUrlPhotoIds;
    cache.saveOnlineTree(tree);
    cache.enqueue({ id: "op-1", treeId: tree.id, kind: "save", expectedRevision: 2, tree, createdAt: "2026-09-02T00:00:00.000Z" });
    cache.enqueue({ id: "op-2", treeId: tree.id, kind: "delete", expectedRevision: 3, tree: null, createdAt: "2026-09-02T00:01:00.000Z" });

    expect(cache.load().pendingOperations.map(operation => operation.id)).toEqual(["op-1", "op-2"]);
    expect(cache.dequeue("op-1")?.id).toBe("op-1");
    expect(cache.load().lastSynchronizedRevisions[tree.id]).toBe(2);
    expect(storage.getItem(TREE_CACHE_STORAGE_KEY)).toBeTruthy();
  });

  it("upgrades schema v1 workspaces, cached trees and pending edits to v2 on load", () => {
    const storage = new MemoryStorage();
    const v1Person = { id: "p1", firstName: "Siti", lastName: "Aminah", gender: "nonbinary", birthDate: "", deathDate: "", notes: "", photoUrl: "", photo: "" };
    const v1Child = { ...v1Person, id: "p2", firstName: "Adi", lastName: "" };
    const workspace = { version: 1, activeTreeId: "t1", trees: [{ id: "t1", name: "Lama", updatedAt: "2026-01-01T00:00:00.000Z", people: [v1Person, v1Child], relationships: [{ id: "r1", type: "parent-child", from: "p1", to: "p2" }] }] };
    const onlineV1 = { id: "t1", ownerId: "owner", name: "Lama", visibility: "private", publicId: null, revision: 3, schemaVersion: 1, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z", publishedRevision: null,
      people: [{ id: "p1", firstName: "Siti", lastName: "Aminah", gender: "female", birthDate: "", deathDate: "", notes: "", photoUrl: "", sortOrder: 0, updatedAt: "2026-01-01T00:00:00.000Z" }, { id: "p2", firstName: "Budi", lastName: "", gender: "male", birthDate: "", deathDate: "", notes: "", photoUrl: "", sortOrder: 1, updatedAt: "2026-01-01T00:00:00.000Z" }],
      relationships: [{ id: "r1", type: "partner", fromPersonId: "p1", toPersonId: "p2", updatedAt: "2026-01-01T00:00:00.000Z" }] };
    storage.setItem(TREE_CACHE_STORAGE_KEY, JSON.stringify({ version: 2, workspace, onlineTrees: { t1: onlineV1 }, lastSynchronizedRevisions: { t1: 3 }, pendingOperations: [{ id: "op", treeId: "t1", kind: "save", expectedRevision: 3, tree: onlineV1, createdAt: "2026-01-01T00:00:00.000Z" }], migration: { completedTreeIds: [], remoteIdsByLocalId: {} } }));
    const cache = new LocalTreeCache(storage).load();
    expect(cache.workspace?.trees[0].people[0]).toMatchObject({ name: "Siti Aminah", gender: "unspecified", birthOrder: null, residence: "" });
    expect(cache.workspace?.trees[0].relationships[0]).toMatchObject({ kind: "biological", status: null, marriedOn: "" });
    for (const tree of [cache.onlineTrees.t1, cache.pendingOperations[0].tree!]) {
      expect(tree.schemaVersion).toBe(2);
      expect(tree.revision).toBe(3);
      expect(tree.people.map(person => person.name)).toEqual(["Siti Aminah", "Budi"]);
      expect(tree.people[0]).not.toHaveProperty("firstName");
      expect(tree.relationships[0]).toMatchObject({ kind: null, status: "married", marriedOn: "" });
    }
  });

  it("keeps malformed cached entries instead of discarding local data during the upgrade", () => {
    const storage = new MemoryStorage();
    const good = { id: "good", name: "Baik", updatedAt: "2026-01-01T00:00:00.000Z", people: [{ id: "p", firstName: "Ani", lastName: "" }], relationships: [] };
    const broken = { id: "broken", name: "Rusak", updatedAt: "2026-01-01T00:00:00.000Z", people: null, relationships: [] };
    const pending = { id: "op", treeId: "t", kind: "save", expectedRevision: 1, tree: { schemaVersion: 1, people: "nope", relationships: [] }, createdAt: "2026-01-01T00:00:00.000Z" };
    storage.setItem(TREE_CACHE_STORAGE_KEY, JSON.stringify({ version: 2, workspace: { version: 1, activeTreeId: "good", trees: [good, broken] }, onlineTrees: null, lastSynchronizedRevisions: {}, pendingOperations: [pending], migration: { completedTreeIds: [], remoteIdsByLocalId: {} } }));
    const cache = new LocalTreeCache(storage).load();
    expect(cache.workspace?.trees.map(tree => tree.id)).toEqual(["good", "broken"]);
    expect(cache.workspace?.trees[0].people[0].name).toBe("Ani");
    expect(cache.workspace?.trees[1]).toEqual(broken);
    expect(cache.pendingOperations).toEqual([pending]);
    expect(cache.onlineTrees).toEqual({});
  });

  it("recovers safely from malformed cache data", () => {
    const storage = new MemoryStorage();
    storage.setItem(TREE_CACHE_STORAGE_KEY, "not json");
    expect(new LocalTreeCache(storage).load()).toMatchObject({ version: 2, pendingOperations: [] });
  });
});
