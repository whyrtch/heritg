"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import { nextRevision } from "../domain/revision";
import { fromOnlineTree } from "../domain/serialization";
import type { OnlineTree } from "../domain/onlineTypes";
import { exportTree } from "../model";
import type { LocalTreeCache, PendingTreeOperation } from "../repository/LocalTreeCache";
import { TreeRepositoryError, type TreeRepository } from "../repository/TreeRepository";
import { initialTreeSyncState, syncReducer } from "./syncReducer";
import type { TreeSyncState } from "./types";

type ConflictResolution = "keep-remote" | "replace-remote";
type TreeMutation = (tree: OnlineTree) => OnlineTree;

export type UseTreeSyncOptions = {
  treeId: string;
  repository: TreeRepository;
  cache: LocalTreeCache;
  createOperationId?: () => string;
  exportLocalBackup?: (tree: OnlineTree) => Promise<void>;
};

async function downloadBackup(tree: OnlineTree): Promise<void> {
  const contents = exportTree(fromOnlineTree(tree));
  const url = URL.createObjectURL(new Blob([contents], { type: "application/json" }));
  try {
    const link = document.createElement("a");
    link.href = url;
    link.download = `${tree.name.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "family-tree"}.heritg`;
    link.click();
  } finally {
    URL.revokeObjectURL(url);
  }
}

function isRepositoryError(error: unknown, code: TreeRepositoryError["code"]): boolean {
  return error instanceof TreeRepositoryError && error.code === code;
}

export function useTreeSync({
  treeId,
  repository,
  cache,
  createOperationId = () => crypto.randomUUID(),
  exportLocalBackup = downloadBackup,
}: UseTreeSyncOptions) {
  const [state, dispatch] = useReducer(syncReducer, initialTreeSyncState);
  const stateRef = useRef<TreeSyncState>(state);
  stateRef.current = state;

  const acknowledge = useCallback((operation: PendingTreeOperation, tree: OnlineTree) => {
    cache.dequeue(operation.id);
    cache.saveOnlineTree(tree);
    dispatch({ type: "acknowledged", operationId: operation.id, tree });
  }, [cache]);

  const persist = useCallback(async (operation: PendingTreeOperation) => {
    if (!operation.tree) return;
    try {
      const saved = await repository.save(operation.tree, operation.expectedRevision ?? 0);
      acknowledge(operation, saved);
    } catch (error) {
      if (isRepositoryError(error, "offline")) {
        cache.enqueue(operation);
        dispatch({ type: "offline", operation });
        return;
      }
      if (isRepositoryError(error, "conflict")) {
        cache.enqueue(operation);
        try {
          const remote = await repository.load(operation.treeId);
          dispatch({ type: "conflict", local: operation.tree, remote });
        } catch (loadError) {
          dispatch({ type: "failed", message: loadError instanceof Error ? loadError.message : "Could not load the remote family tree." });
        }
        return;
      }
      dispatch({ type: "failed", message: error instanceof Error ? error.message : "Could not save the family tree." });
    }
  }, [acknowledge, cache, repository]);

  const retry = useCallback(async () => {
    dispatch({ type: "retrying" });
    const operations = cache.load().pendingOperations.filter(operation => operation.treeId === treeId);
    if (!operations.length) {
      try {
        const remote = await repository.load(treeId);
        cache.saveOnlineTree(remote);
        dispatch({ type: "loaded", tree: remote });
      } catch (error) {
        dispatch({ type: "failed", message: error instanceof Error ? error.message : "Could not reload the family tree." });
      }
      return;
    }

    for (const operation of operations) {
      try {
        if (operation.kind === "create" && operation.tree) {
          acknowledge(operation, await repository.create(operation.tree));
          continue;
        }
        if (operation.kind === "delete") {
          await repository.delete(operation.treeId);
          cache.dequeue(operation.id);
          continue;
        }
        if (!operation.tree || operation.expectedRevision === null) continue;
        const remote = await repository.load(operation.treeId);
        if (remote.revision === operation.tree.revision) {
          acknowledge(operation, remote);
          continue;
        }
        if (remote.revision !== operation.expectedRevision) {
          dispatch({ type: "conflict", local: operation.tree, remote });
          return;
        }
        acknowledge(operation, await repository.save(operation.tree, operation.expectedRevision));
      } catch (error) {
        if (isRepositoryError(error, "offline")) {
          dispatch({ type: "offline", operation });
          return;
        }
        if (isRepositoryError(error, "conflict") && operation.tree) {
          try {
            dispatch({ type: "conflict", local: operation.tree, remote: await repository.load(operation.treeId) });
          } catch (loadError) {
            dispatch({ type: "failed", message: loadError instanceof Error ? loadError.message : "Could not load the conflict." });
          }
          return;
        }
        dispatch({ type: "failed", message: error instanceof Error ? error.message : "Could not replay offline changes." });
        return;
      }
    }
  }, [acknowledge, cache, repository, treeId]);

  useEffect(() => {
    let active = true;
    repository.load(treeId).then(tree => {
      if (!active) return;
      cache.saveOnlineTree(tree);
      const pending = cache.load().pendingOperations.filter(operation => operation.treeId === treeId);
      dispatch({ type: "loaded", tree: pending.at(-1)?.tree ?? tree, pendingOperations: pending });
    }).catch(error => {
      if (!active) return;
      const cached = cache.load().onlineTrees[treeId];
      if (cached && isRepositoryError(error, "offline")) {
        dispatch({ type: "loaded", tree: cached, pendingOperations: cache.load().pendingOperations.filter(operation => operation.treeId === treeId) });
      } else dispatch({ type: "failed", message: error instanceof Error ? error.message : "Could not load the family tree." });
    });
    return () => { active = false; };
  }, [cache, repository, treeId]);

  useEffect(() => {
    const reconnect = () => { void retry(); };
    window.addEventListener("online", reconnect);
    return () => window.removeEventListener("online", reconnect);
  }, [retry]);

  const mutate = useCallback((mutation: TreeMutation) => {
    const current = stateRef.current.tree;
    if (!current || stateRef.current.status === "conflict") return null;
    const mutated = mutation(structuredClone(current));
    const optimistic = { ...mutated, id: current.id, ownerId: current.ownerId, revision: nextRevision(current.revision), updatedAt: new Date().toISOString() };
    const operation: PendingTreeOperation = {
      id: createOperationId(), treeId: current.id, kind: "save", expectedRevision: current.revision, tree: optimistic, createdAt: new Date().toISOString(),
    };
    cache.enqueue(operation);
    cache.saveOnlineTree(optimistic);
    dispatch({ type: "optimistic", tree: optimistic, operation });
    void persist(operation);
    return operation.id;
  }, [cache, createOperationId, persist]);

  const resolveConflict = useCallback(async (resolution: ConflictResolution) => {
    const conflict = stateRef.current.conflict;
    if (!conflict) return;
    if (resolution === "keep-remote") {
      try {
        await exportLocalBackup(conflict.local);
        cache.load().pendingOperations.filter(operation => operation.treeId === treeId).forEach(operation => cache.dequeue(operation.id));
        cache.saveOnlineTree(conflict.remote);
        dispatch({ type: "resolved", tree: conflict.remote });
      } catch (error) {
        dispatch({ type: "failed", message: error instanceof Error ? error.message : "The local backup could not be exported." });
      }
      return;
    }
    if (!stateRef.current.replaceConfirmationRequired) {
      dispatch({ type: "arm-replace" });
      return;
    }
    try {
      const saved = await repository.save(conflict.local, conflict.remote.revision);
      cache.load().pendingOperations.filter(operation => operation.treeId === treeId).forEach(operation => cache.dequeue(operation.id));
      cache.saveOnlineTree(saved);
      dispatch({ type: "resolved", tree: saved });
    } catch (error) {
      dispatch({ type: "failed", message: error instanceof Error ? error.message : "The remote family tree could not be replaced." });
    }
  }, [cache, exportLocalBackup, repository, treeId]);

  const markPublicStale = useCallback(() => dispatch({ type: "public-stale" }), []);
  return { state, mutate, retry, resolveConflict, markPublicStale };
}
