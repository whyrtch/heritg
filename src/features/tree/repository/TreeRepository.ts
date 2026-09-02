import type { OnlineTree } from "../domain/onlineTypes";

export type TreeRepositoryErrorCode = "permission-denied" | "offline" | "conflict" | "not-found" | "invalid-data";

export class TreeRepositoryError extends Error {
  constructor(public readonly code: TreeRepositoryErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "TreeRepositoryError";
  }
}

export interface TreeRepository {
  listOwned(uid: string): Promise<OnlineTree[]>;
  load(treeId: string): Promise<OnlineTree>;
  create(tree: OnlineTree): Promise<OnlineTree>;
  save(tree: OnlineTree, expectedRevision: number): Promise<OnlineTree>;
  delete(treeId: string): Promise<void>;
}

export function cloneTree(tree: OnlineTree): OnlineTree {
  return structuredClone(tree);
}
