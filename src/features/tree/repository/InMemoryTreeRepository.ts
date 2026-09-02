import type { OnlineTree } from "../domain/onlineTypes";
import { nextRevision } from "../domain/revision";
import { cloneTree, TreeRepositoryError, type TreeRepository } from "./TreeRepository";

export class InMemoryTreeRepository implements TreeRepository {
  private readonly trees = new Map<string, OnlineTree>();

  constructor(seed: OnlineTree[] = []) {
    for (const tree of seed) this.trees.set(tree.id, cloneTree(tree));
  }

  async listOwned(uid: string): Promise<OnlineTree[]> {
    return [...this.trees.values()]
      .filter(tree => tree.ownerId === uid)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .map(cloneTree);
  }

  async load(treeId: string): Promise<OnlineTree> {
    const tree = this.trees.get(treeId);
    if (!tree) throw new TreeRepositoryError("not-found", "Family tree was not found.");
    return cloneTree(tree);
  }

  async create(tree: OnlineTree): Promise<OnlineTree> {
    if (this.trees.has(tree.id)) throw new TreeRepositoryError("conflict", "A family tree with this ID already exists.");
    if (!tree.ownerId) throw new TreeRepositoryError("invalid-data", "A family tree owner is required.");
    const created = cloneTree(tree);
    this.trees.set(created.id, created);
    return cloneTree(created);
  }

  async save(tree: OnlineTree, expectedRevision: number): Promise<OnlineTree> {
    const current = this.trees.get(tree.id);
    if (!current) throw new TreeRepositoryError("not-found", "Family tree was not found.");
    if (current.ownerId !== tree.ownerId) throw new TreeRepositoryError("permission-denied", "The family tree owner cannot be changed.");
    if (current.revision !== expectedRevision) throw new TreeRepositoryError("conflict", "The family tree was updated elsewhere.");
    const saved = cloneTree({ ...tree, revision: nextRevision(expectedRevision) });
    this.trees.set(saved.id, saved);
    return cloneTree(saved);
  }

  async delete(treeId: string): Promise<void> {
    if (!this.trees.delete(treeId)) throw new TreeRepositoryError("not-found", "Family tree was not found.");
  }
}
