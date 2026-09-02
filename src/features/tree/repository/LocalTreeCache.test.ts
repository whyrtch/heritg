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

  it("recovers safely from malformed cache data", () => {
    const storage = new MemoryStorage();
    storage.setItem(TREE_CACHE_STORAGE_KEY, "not json");
    expect(new LocalTreeCache(storage).load()).toMatchObject({ version: 2, pendingOperations: [] });
  });
});
