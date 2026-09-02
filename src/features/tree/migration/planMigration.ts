import type { WorkspaceData } from "../model";
import { toOnlineTree } from "../domain/serialization";
import type { MigrationMappings, MigrationPlan, MigrationPlanItem } from "./types";

export type PlanMigrationOptions = {
  ownerId?: string;
  selectedTreeIds?: string[];
  idFactory?: () => string;
};

const cloneMappings = (mappings: MigrationMappings): MigrationMappings => ({
  remoteIdsByLocalId: { ...mappings.remoteIdsByLocalId },
  completedTreeIds: [...new Set(mappings.completedTreeIds)],
});

export function planMigration(local: WorkspaceData, mappings: MigrationMappings, options: PlanMigrationOptions = {}): MigrationPlan {
  const nextMappings = cloneMappings(mappings);
  const selected = options.selectedTreeIds ? new Set(options.selectedTreeIds) : null;
  const idFactory = options.idFactory ?? (() => crypto.randomUUID());

  const items: MigrationPlanItem[] = local.trees
    .filter(tree => !selected || selected.has(tree.id))
    .map(tree => {
      const remoteTreeId = nextMappings.remoteIdsByLocalId[tree.id] ?? idFactory();
      nextMappings.remoteIdsByLocalId[tree.id] = remoteTreeId;
      const validationErrors: string[] = [];
      let excludedPhotoIds: string[] = [];
      try {
        excludedPhotoIds = toOnlineTree(tree, { ownerId: options.ownerId ?? "migration-preview" }).excludedDataUrlPhotoIds;
      } catch (error) {
        validationErrors.push(error instanceof Error ? error.message : "Family tree data is invalid.");
      }
      return {
        localTreeId: tree.id,
        remoteTreeId,
        name: tree.name || "Untitled family tree",
        tree,
        personCount: tree.people.length,
        relationshipCount: tree.relationships.length,
        excludedPhotoIds,
        estimatedWrites: 2 + tree.people.length + tree.relationships.length,
        validationErrors,
        alreadyCompleted: nextMappings.completedTreeIds.includes(tree.id),
      };
    });

  const pendingValidItems = items.filter(item => !item.alreadyCompleted && item.validationErrors.length === 0);
  return {
    source: local,
    ownerId: options.ownerId ?? "",
    items,
    mappings: nextMappings,
    totals: {
      treeCount: items.length,
      personCount: items.reduce((total, item) => total + item.personCount, 0),
      relationshipCount: items.reduce((total, item) => total + item.relationshipCount, 0),
      excludedPhotoCount: items.reduce((total, item) => total + item.excludedPhotoIds.length, 0),
      estimatedWrites: pendingValidItems.reduce((total, item) => total + item.estimatedWrites, 0),
    },
  };
}
