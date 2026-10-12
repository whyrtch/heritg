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

/**
 * Whether the server copy holds exactly this edit (ignoring timestamps and server-owned photo versions).
 * Used to recognise a save that landed although its answer was lost. Any doubt counts as different,
 * which shows a conflict instead of silently dropping an edit.
 */
function sameContent(a: OnlineTree, b: OnlineTree): boolean {
  const byId = <T extends { id: string }>(items: T[]) => [...items].sort((x, y) => x.id.localeCompare(y.id));
  const content = (tree: OnlineTree) => JSON.stringify({
    name: tree.name,
    people: byId(tree.people).map(({ updatedAt, photoVersion, ...person }) => { void updatedAt; void photoVersion; return person; }),
    relationships: byId(tree.relationships).map(({ updatedAt, ...relationship }) => { void updatedAt; return relationship; }),
  });
  return content(a) === content(b);
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

  /**
   * The only place that talks to the server for this tree. It works through the cached operations in
   * order, one request at a time (each save expects the revision the previous one produces), and picks up
   * operations added while it runs. It stops when offline (they wait), on a conflict, or on an error.
   * Every trigger — an edit, Retry, the browser coming back online, operations left from a previous
   * session — calls this, so two requests for the same tree are never in flight at once.
   */
  const draining = useRef<Promise<void> | null>(null);
  const drainAgain = useRef(false);
  // Set the moment a conflict is found (state only updates on the next render) and cleared once resolved.
  const inConflict = useRef(false);
  const pendingFor = useCallback(() => cache.load().pendingOperations.filter(operation => operation.treeId === treeId), [cache, treeId]);

  const drainOnce = useCallback(async (): Promise<void> => {
    for (;;) {
      if (inConflict.current) return;
      const operation = pendingFor()[0];
      if (!operation) return;
      try {
        if (operation.kind === "create" && operation.tree) { acknowledge(operation, await repository.create(operation.tree)); continue; }
        if (operation.kind === "delete") { await repository.delete(operation.treeId); cache.dequeue(operation.id); continue; }
        if (!operation.tree || operation.expectedRevision === null) { cache.dequeue(operation.id); continue; }
        acknowledge(operation, await repository.save(operation.tree, operation.expectedRevision));
      } catch (error) {
        if (isRepositoryError(error, "offline")) { dispatch({ type: "offline", operation }); return; }
        if (isRepositoryError(error, "conflict") && operation.tree) {
          try {
            const remote = await repository.load(operation.treeId);
            // Our save already landed (its acknowledgement was lost): accept it and carry on.
            if (remote.revision === operation.tree.revision && sameContent(remote, operation.tree)) { acknowledge(operation, remote); continue; }
            // Show the newest local version (the last waiting operation holds the whole tree with every edit).
            const latest = pendingFor().at(-1)?.tree ?? operation.tree;
            inConflict.current = true;
            dispatch({ type: "conflict", local: latest, remote });
          } catch (loadError) {
            dispatch({ type: "failed", message: loadError instanceof Error ? loadError.message : "Could not load the remote family tree." });
          }
          return;
        }
        dispatch({ type: "failed", message: error instanceof Error ? error.message : "Could not save the family tree." });
        return;
      }
    }
  }, [acknowledge, cache, pendingFor, repository]);

  const drain = useCallback((): Promise<void> => {
    if (draining.current) { drainAgain.current = true; return draining.current; }
    const run = (async () => {
      try {
        do { drainAgain.current = false; await drainOnce(); } while (drainAgain.current && !inConflict.current);
      } finally {
        draining.current = null;
      }
    })();
    draining.current = run;
    return run;
  }, [drainOnce]);

  /** Retry button / back online: send what is waiting, or (nothing waiting) reload the server copy. */
  const retry = useCallback(async () => {
    // A conflict waits for the owner to choose; reconnecting must not hide it.
    if (inConflict.current) return;
    if (draining.current) { drainAgain.current = true; return draining.current; }
    dispatch({ type: "retrying" });
    if (pendingFor().length) return drain();
    try {
      const remote = await repository.load(treeId);
      // An edit made during the reload is newer than this copy; it will be sent instead.
      if (pendingFor().length || draining.current) return drain();
      // Never step back to an older copy than the one already shown.
      if (stateRef.current.tree && stateRef.current.tree.revision > remote.revision) { dispatch({ type: "loaded", tree: stateRef.current.tree }); return; }
      cache.saveOnlineTree(remote);
      dispatch({ type: "loaded", tree: remote });
    } catch (error) {
      dispatch({ type: "failed", message: error instanceof Error ? error.message : "Could not reload the family tree." });
    }
  }, [cache, drain, pendingFor, repository, treeId]);

  useEffect(() => {
    let active = true;
    inConflict.current = false;
    repository.load(treeId).then(tree => {
      if (!active) return;
      cache.saveOnlineTree(tree);
      const pending = cache.load().pendingOperations.filter(operation => operation.treeId === treeId);
      dispatch({ type: "loaded", tree: pending.at(-1)?.tree ?? tree, pendingOperations: pending });
      // Edits left from an earlier visit are sent now that the server answered.
      if (pending.length) void drain();
    }).catch(error => {
      if (!active) return;
      const cached = cache.load().onlineTrees[treeId];
      if (cached && isRepositoryError(error, "offline")) {
        dispatch({ type: "loaded", tree: cached, pendingOperations: cache.load().pendingOperations.filter(operation => operation.treeId === treeId) });
      } else dispatch({ type: "failed", message: error instanceof Error ? error.message : "Could not load the family tree." });
    });
    return () => { active = false; };
  }, [cache, drain, repository, treeId]);

  useEffect(() => {
    const reconnect = () => { void retry(); };
    window.addEventListener("online", reconnect);
    return () => window.removeEventListener("online", reconnect);
  }, [retry]);

  const mutate = useCallback((mutation: TreeMutation) => {
    const current = stateRef.current.tree;
    if (!current || inConflict.current) return null;
    const mutated = mutation(structuredClone(current));
    const optimistic = { ...mutated, id: current.id, ownerId: current.ownerId, revision: nextRevision(current.revision), updatedAt: new Date().toISOString() };
    const operation: PendingTreeOperation = {
      id: createOperationId(), treeId: current.id, kind: "save", expectedRevision: current.revision, tree: optimistic, createdAt: new Date().toISOString(),
    };
    cache.enqueue(operation);
    cache.saveOnlineTree(optimistic);
    dispatch({ type: "optimistic", tree: optimistic, operation });
    void drain();
    return operation.id;
  }, [cache, createOperationId, drain]);

  const resolveConflict = useCallback(async (resolution: ConflictResolution) => {
    const conflict = stateRef.current.conflict;
    if (!conflict) return;
    if (resolution === "keep-remote") {
      try {
        await exportLocalBackup(conflict.local);
        cache.load().pendingOperations.filter(operation => operation.treeId === treeId).forEach(operation => cache.dequeue(operation.id));
        cache.saveOnlineTree(conflict.remote);
        inConflict.current = false;
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
      inConflict.current = false;
      dispatch({ type: "resolved", tree: saved });
    } catch (error) {
      dispatch({ type: "failed", message: error instanceof Error ? error.message : "The remote family tree could not be replaced." });
    }
  }, [cache, exportLocalBackup, repository, treeId]);

  const markPublicStale = useCallback(() => dispatch({ type: "public-stale" }), []);
  return { state, mutate, retry, resolveConflict, markPublicStale };
}
