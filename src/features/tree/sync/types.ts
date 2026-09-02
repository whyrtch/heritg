import type { OnlineTree } from "../domain/onlineTypes";
import type { PendingTreeOperation } from "../repository/LocalTreeCache";

export type SyncStatus = "loading" | "saving" | "saved" | "offline" | "conflict" | "public-stale";

export type TreeConflict = { local: OnlineTree; remote: OnlineTree };

export type TreeSyncState = {
  status: SyncStatus;
  tree: OnlineTree | null;
  pendingOperations: PendingTreeOperation[];
  conflict: TreeConflict | null;
  replaceConfirmationRequired: boolean;
  error: string | null;
};

export type TreeSyncAction =
  | { type: "loaded"; tree: OnlineTree; pendingOperations?: PendingTreeOperation[] }
  | { type: "optimistic"; tree: OnlineTree; operation: PendingTreeOperation }
  | { type: "acknowledged"; tree: OnlineTree; operationId: string }
  | { type: "offline"; operation: PendingTreeOperation }
  | { type: "conflict"; local: OnlineTree; remote: OnlineTree }
  | { type: "retrying" }
  | { type: "public-stale" }
  | { type: "arm-replace" }
  | { type: "resolved"; tree: OnlineTree }
  | { type: "failed"; message: string };
