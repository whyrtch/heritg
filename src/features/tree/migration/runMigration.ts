import { toOnlineTree } from "../domain/serialization";
import type { WorkspaceData } from "../model";
import { planMigration } from "./planMigration";
import type { OnlineTree } from "../domain/onlineTypes";
import { TreeRepositoryError, type TreeRepository } from "../repository/TreeRepository";
import type { LocalTreeCache } from "../repository/LocalTreeCache";
import type { MigrationMappings, MigrationPlan, MigrationProgress, MigrationRunResult, MigrationStateStore } from "./types";

export class LocalCacheMigrationStateStore implements MigrationStateStore {
  constructor(private readonly cache: LocalTreeCache) {}
  load(): MigrationMappings {
    const { migration } = this.cache.load();
    return { remoteIdsByLocalId: { ...migration.remoteIdsByLocalId }, completedTreeIds: [...migration.completedTreeIds] };
  }
  save(mappings: MigrationMappings): void {
    const current = this.cache.load();
    this.cache.save({ ...current, migration: { remoteIdsByLocalId: { ...mappings.remoteIdsByLocalId }, completedTreeIds: [...mappings.completedTreeIds] } });
  }
}

function verified(remote: OnlineTree, expected: OnlineTree): boolean {
  return remote.id === expected.id && remote.ownerId === expected.ownerId && remote.revision === expected.revision
    && remote.people.length === expected.people.length && remote.relationships.length === expected.relationships.length;
}

function message(error: unknown): string {
  if (error instanceof TreeRepositoryError) return error.message;
  return error instanceof Error ? error.message : "Migration failed. Your local tree is unchanged.";
}

export async function runMigration(
  plan: MigrationPlan,
  repository: TreeRepository,
  state: MigrationStateStore,
  options: { selectedTreeIds?: string[]; onProgress?: (progress: MigrationProgress) => void } = {},
): Promise<MigrationRunResult> {
  if (!plan.ownerId) throw new Error("An authenticated owner is required for migration.");
  const selected = options.selectedTreeIds ? new Set(options.selectedTreeIds) : null;
  const items = plan.items.filter(item => (!selected || selected.has(item.localTreeId)) && !item.alreadyCompleted && item.validationErrors.length === 0 && item.tree);
  const mappings = state.load();
  mappings.remoteIdsByLocalId = { ...mappings.remoteIdsByLocalId, ...plan.mappings.remoteIdsByLocalId };
  options.onProgress?.({ localTreeId: "", completed: 0, total: items.length, status: "mapping" });
  await state.save(mappings); // Durable IDs must exist before the first remote mutation.

  const failed: MigrationRunResult["failed"] = [];
  let completed = 0;
  for (const item of items) {
    const local = item.tree!;
    const serialized = toOnlineTree(local, { ownerId: plan.ownerId, revision: 0 });
    const tree: OnlineTree = {
      id: item.remoteTreeId,
      ownerId: serialized.ownerId,
      name: serialized.name,
      visibility: serialized.visibility,
      publicId: serialized.publicId,
      revision: serialized.revision,
      schemaVersion: serialized.schemaVersion,
      createdAt: serialized.createdAt,
      updatedAt: serialized.updatedAt,
      publishedRevision: serialized.publishedRevision,
      people: serialized.people.map(person => ({ ...person })),
      relationships: serialized.relationships.map(relationship => ({ ...relationship })),
    };
    try {
      options.onProgress?.({ localTreeId: item.localTreeId, completed, total: items.length, status: "uploading" });
      try {
        await repository.create(tree);
      } catch (error) {
        if (!(error instanceof TreeRepositoryError) || error.code !== "conflict") throw error;
        // A previous interrupted run may have created this deterministic remote ID.
      }
      options.onProgress?.({ localTreeId: item.localTreeId, completed, total: items.length, status: "verifying" });
      const remote = await repository.load(item.remoteTreeId);
      if (!verified(remote, tree)) throw new Error("Remote verification did not match the local family tree.");
      completed += 1;
      mappings.completedTreeIds = [...new Set([...mappings.completedTreeIds, item.localTreeId])];
      await state.save(mappings);
      options.onProgress?.({ localTreeId: item.localTreeId, completed, total: items.length, status: "completed" });
    } catch (error) {
      const detail = message(error);
      failed.push({ localTreeId: item.localTreeId, error: detail });
      options.onProgress?.({ localTreeId: item.localTreeId, completed, total: items.length, status: "failed", error: detail });
    }
  }

  return { completedTreeIds: [...mappings.completedTreeIds], failed, mappings };
}

/**
 * Puts a tree the signed-in owner just created or imported online straight away,
 * reusing the verified migration path, so it never shows up in the migration prompt.
 */
export async function uploadNewTree(
  source: WorkspaceData,
  localTreeId: string,
  ownerId: string,
  repository: TreeRepository,
  state: MigrationStateStore,
  idFactory?: () => string,
): Promise<MigrationRunResult> {
  const plan = planMigration(source, await state.load(), { ownerId, selectedTreeIds: [localTreeId], idFactory });
  return runMigration(plan, repository, state, { selectedTreeIds: [localTreeId] });
}
