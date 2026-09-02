import { describe, expect, it } from "vitest";
import { createJokowiDemoTree } from "../demoData";
import { toOnlineTree } from "../domain/serialization";
import type { OnlineTree } from "../domain/onlineTypes";
import type { PendingTreeOperation } from "../repository/LocalTreeCache";
import { initialTreeSyncState, syncReducer } from "./syncReducer";

function tree(revision = 0): OnlineTree {
  const serialized = toOnlineTree(createJokowiDemoTree(), { ownerId: "owner", revision });
  const { excludedDataUrlPhotoIds, ...online } = serialized;
  void excludedDataUrlPhotoIds;
  return online;
}

function operation(value: OnlineTree): PendingTreeOperation {
  return { id: "op-1", treeId: value.id, kind: "save", expectedRevision: value.revision - 1, tree: value, createdAt: "2026-09-02T00:00:00.000Z" };
}

describe("syncReducer", () => {
  it("tracks optimistic writes and acknowledgements", () => {
    const optimistic = tree(1);
    const saving = syncReducer({ ...initialTreeSyncState, status: "saved", tree: tree(0) }, { type: "optimistic", tree: optimistic, operation: operation(optimistic) });
    expect(saving).toMatchObject({ status: "saving", tree: { revision: 1 } });
    expect(syncReducer(saving, { type: "acknowledged", tree: optimistic, operationId: "op-1" })).toMatchObject({ status: "saved", pendingOperations: [] });
  });

  it("retains an operation offline and exposes conflicts", () => {
    const local = tree(1), remote = tree(2), op = operation(local);
    const offline = syncReducer(initialTreeSyncState, { type: "offline", operation: op });
    expect(offline).toMatchObject({ status: "offline", pendingOperations: [op] });
    expect(syncReducer(offline, { type: "conflict", local, remote })).toMatchObject({ status: "conflict", conflict: { local, remote } });
  });
});
