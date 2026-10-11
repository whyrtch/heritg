import type { OnlineTree } from "../domain/onlineTypes";
import { upgradeOnlineTree } from "../domain/serialization";
import { normalizeTree, type WorkspaceData } from "../model";

export const LEGACY_WORKSPACE_STORAGE_KEY = "heritg-workspace-v1";
export const TREE_CACHE_STORAGE_KEY = "heritg-tree-cache-v2";

export type PendingTreeOperation = {
  id: string;
  treeId: string;
  kind: "create" | "save" | "delete";
  expectedRevision: number | null;
  tree: OnlineTree | null;
  createdAt: string;
};

export type LocalTreeCacheData = {
  version: 2;
  workspace: WorkspaceData | null;
  onlineTrees: Record<string, OnlineTree>;
  lastSynchronizedRevisions: Record<string, number>;
  pendingOperations: PendingTreeOperation[];
  migration: { completedTreeIds: string[]; remoteIdsByLocalId: Record<string, string> };
};

type StorageLike = Pick<Storage, "getItem" | "setItem">;

const emptyCache = (): LocalTreeCacheData => ({
  version: 2,
  workspace: null,
  onlineTrees: {},
  lastSynchronizedRevisions: {},
  pendingOperations: [],
  migration: { completedTreeIds: [], remoteIdsByLocalId: {} },
});

function isWorkspaceData(value: unknown): value is WorkspaceData {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<WorkspaceData>;
  return candidate.version === 1 && typeof candidate.activeTreeId === "string" && Array.isArray(candidate.trees);
}

/** Data written before schema v2 (firstName/lastName, untyped relationships) is upgraded on read. */
// Each item is upgraded on its own: a malformed entry is kept as it was instead of discarding the whole
// cache, because an empty cache would then be written back over local trees and pending edits.
function attempt<T>(upgrade: (value: T) => T, value: T): T {
  try { return upgrade(value); } catch { return value; }
}

function normalizeWorkspaceTrees(workspace: WorkspaceData): WorkspaceData {
  return { ...workspace, trees: workspace.trees.map(tree => attempt(normalizeTree, tree)) };
}

function upgradeCache(cache: LocalTreeCacheData): LocalTreeCacheData {
  const onlineTrees = cache.onlineTrees && typeof cache.onlineTrees === "object" ? cache.onlineTrees : {};
  return {
    ...cache,
    workspace: cache.workspace && isWorkspaceData(cache.workspace) ? normalizeWorkspaceTrees(cache.workspace) : cache.workspace,
    onlineTrees: Object.fromEntries(Object.entries(onlineTrees).map(([id, tree]) => [id, attempt(upgradeOnlineTree, tree)])),
    pendingOperations: cache.pendingOperations.map(operation => attempt(item => item?.tree ? { ...item, tree: upgradeOnlineTree(item.tree) } : item, operation)),
  };
}

export class LocalTreeCache {
  constructor(private readonly storage: StorageLike, private readonly key = TREE_CACHE_STORAGE_KEY) {}

  load(): LocalTreeCacheData {
    try {
      const raw = this.storage.getItem(this.key);
      if (raw) {
        const value = JSON.parse(raw) as Partial<LocalTreeCacheData>;
        if (value.version === 2 && Array.isArray(value.pendingOperations)) return upgradeCache({ ...emptyCache(), ...value } as LocalTreeCacheData);
      }
      const legacyRaw = this.storage.getItem(LEGACY_WORKSPACE_STORAGE_KEY);
      if (legacyRaw) {
        const legacy = JSON.parse(legacyRaw) as unknown;
        if (isWorkspaceData(legacy)) return { ...emptyCache(), workspace: normalizeWorkspaceTrees(legacy) };
      }
    } catch {
      // Corrupt browser data must not prevent the app from starting.
    }
    return emptyCache();
  }

  save(data: LocalTreeCacheData): void {
    this.storage.setItem(this.key, JSON.stringify(data));
    if (data.workspace) this.storage.setItem(LEGACY_WORKSPACE_STORAGE_KEY, JSON.stringify(data.workspace));
  }

  loadWorkspace(): WorkspaceData | null {
    return this.load().workspace;
  }

  saveWorkspace(workspace: WorkspaceData): void {
    this.save({ ...this.load(), workspace });
  }

  saveOnlineTree(tree: OnlineTree): void {
    const cache = this.load();
    this.save({
      ...cache,
      onlineTrees: { ...cache.onlineTrees, [tree.id]: structuredClone(tree) },
      lastSynchronizedRevisions: { ...cache.lastSynchronizedRevisions, [tree.id]: tree.revision },
    });
  }

  enqueue(operation: PendingTreeOperation): void {
    const cache = this.load();
    if (cache.pendingOperations.some(item => item.id === operation.id)) return;
    this.save({ ...cache, pendingOperations: [...cache.pendingOperations, structuredClone(operation)] });
  }

  dequeue(operationId: string): PendingTreeOperation | null {
    const cache = this.load();
    const operation = cache.pendingOperations.find(item => item.id === operationId) ?? null;
    if (!operation) return null;
    this.save({ ...cache, pendingOperations: cache.pendingOperations.filter(item => item.id !== operationId) });
    return structuredClone(operation);
  }
}
