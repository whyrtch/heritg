import type { FamilyTree, WorkspaceData } from "../model";

export type MigrationMappings = {
  remoteIdsByLocalId: Record<string, string>;
  completedTreeIds: string[];
};

export type MigrationPlanItem = {
  localTreeId: string;
  remoteTreeId: string;
  name: string;
  tree: FamilyTree | null;
  personCount: number;
  relationshipCount: number;
  excludedPhotoIds: string[];
  estimatedWrites: number;
  validationErrors: string[];
  alreadyCompleted: boolean;
};

export type MigrationPlan = {
  source: WorkspaceData;
  ownerId: string;
  items: MigrationPlanItem[];
  mappings: MigrationMappings;
  totals: {
    treeCount: number;
    personCount: number;
    relationshipCount: number;
    excludedPhotoCount: number;
    estimatedWrites: number;
  };
};

export type MigrationProgress = {
  localTreeId: string;
  completed: number;
  total: number;
  status: "mapping" | "uploading" | "verifying" | "completed" | "failed";
  error?: string;
};

export interface MigrationStateStore {
  load(): MigrationMappings;
  save(mappings: MigrationMappings): void | Promise<void>;
}

export type MigrationRunResult = {
  completedTreeIds: string[];
  failed: Array<{ localTreeId: string; error: string }>;
  mappings: MigrationMappings;
};
