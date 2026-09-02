import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createJokowiDemoTree } from "../demoData";
import type { OnlineTree } from "../domain/onlineTypes";
import { toOnlineTree } from "../domain/serialization";
import { InMemoryTreeRepository } from "../repository/InMemoryTreeRepository";
import { LocalTreeCache } from "../repository/LocalTreeCache";
import { TreeRepositoryError, type TreeRepository } from "../repository/TreeRepository";
import { useTreeSync } from "./useTreeSync";

class MemoryStorage {
  private values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

function tree(revision = 0): OnlineTree {
  const { excludedDataUrlPhotoIds, ...online } = toOnlineTree(createJokowiDemoTree(), { ownerId: "owner", revision });
  void excludedDataUrlPhotoIds;
  return online;
}

class ControllableRepository implements TreeRepository {
  readonly inner: InMemoryTreeRepository;
  offline = false;
  saveCalls = 0;
  constructor(seed: OnlineTree) { this.inner = new InMemoryTreeRepository([seed]); }
  listOwned(uid: string) { return this.inner.listOwned(uid); }
  load(id: string) { return this.inner.load(id); }
  create(value: OnlineTree) { return this.inner.create(value); }
  delete(id: string) { return this.inner.delete(id); }
  save(value: OnlineTree, expected: number) {
    this.saveCalls += 1;
    if (this.offline) return Promise.reject(new TreeRepositoryError("offline", "Offline"));
    return this.inner.save(value, expected);
  }
}

describe("useTreeSync", () => {
  it("applies optimistic changes, acknowledges saves, and replays offline work", async () => {
    const initial = tree();
    const repository = new ControllableRepository(initial);
    const cache = new LocalTreeCache(new MemoryStorage());
    const { result } = renderHook(() => useTreeSync({ treeId: initial.id, repository, cache, createOperationId: () => "op-1" }));
    await waitFor(() => expect(result.current.state.status).toBe("saved"));

    repository.offline = true;
    act(() => { result.current.mutate(current => ({ ...current, name: "Offline name" })); });
    await waitFor(() => expect(result.current.state.status).toBe("offline"));
    expect(cache.load().pendingOperations).toHaveLength(1);

    repository.offline = false;
    await act(async () => { await result.current.retry(); });
    await waitFor(() => expect(result.current.state.status).toBe("saved"));
    expect(result.current.state.tree).toMatchObject({ name: "Offline name", revision: 1 });
    expect(cache.load().pendingOperations).toHaveLength(0);
  });

  it("deduplicates an operation whose acknowledgement was lost", async () => {
    const remote = tree(1);
    const repository = new ControllableRepository(remote);
    const cache = new LocalTreeCache(new MemoryStorage());
    cache.enqueue({ id: "already-saved", treeId: remote.id, kind: "save", expectedRevision: 0, tree: remote, createdAt: remote.updatedAt });
    const { result } = renderHook(() => useTreeSync({ treeId: remote.id, repository, cache }));
    await waitFor(() => expect(result.current.state.status).toBe("offline"));
    await act(async () => { await result.current.retry(); });
    expect(repository.saveCalls).toBe(0);
    expect(cache.load().pendingOperations).toHaveLength(0);
  });

  it("exports before keeping remote and requires two replace actions", async () => {
    const initial = tree();
    const repository = new ControllableRepository(initial);
    const cache = new LocalTreeCache(new MemoryStorage());
    const backup = vi.fn(async () => undefined);
    const { result } = renderHook(() => useTreeSync({ treeId: initial.id, repository, cache, exportLocalBackup: backup, createOperationId: () => "conflicting-op" }));
    await waitFor(() => expect(result.current.state.status).toBe("saved"));
    await repository.inner.save({ ...initial, name: "Remote edit" }, 0);
    act(() => { result.current.mutate(current => ({ ...current, name: "Local edit" })); });
    await waitFor(() => expect(result.current.state.status).toBe("conflict"));

    await act(async () => { await result.current.resolveConflict("keep-remote"); });
    expect(backup).toHaveBeenCalledOnce();
    expect(result.current.state.tree?.name).toBe("Remote edit");

    const secondRepository = new ControllableRepository(initial);
    const secondCache = new LocalTreeCache(new MemoryStorage());
    const second = renderHook(() => useTreeSync({ treeId: initial.id, repository: secondRepository, cache: secondCache, createOperationId: () => "second-conflict" }));
    await waitFor(() => expect(second.result.current.state.status).toBe("saved"));
    await secondRepository.inner.save({ ...initial, name: "Remote edit" }, 0);
    act(() => { second.result.current.mutate(current => ({ ...current, name: "Local wins" })); });
    await waitFor(() => expect(second.result.current.state.status).toBe("conflict"));
    const callsBeforeConfirmation = secondRepository.saveCalls;
    await act(async () => { await second.result.current.resolveConflict("replace-remote"); });
    expect(second.result.current.state.replaceConfirmationRequired).toBe(true);
    expect(secondRepository.saveCalls).toBe(callsBeforeConfirmation);
    await act(async () => { await second.result.current.resolveConflict("replace-remote"); });
    await waitFor(() => expect(second.result.current.state.status).toBe("saved"));
    expect(second.result.current.state.tree?.name).toBe("Local wins");
  });
});
