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
  it("sends quick successive edits one at a time and never rolls back the newer one", async () => {
    const initial = tree();
    const repository = new ControllableRepository(initial);
    const releases: (() => void)[] = [];
    const inner = repository.save.bind(repository);
    let inFlight = 0, maxInFlight = 0;
    repository.save = (value, expected) => new Promise((resolve, reject) => {
      inFlight += 1; maxInFlight = Math.max(maxInFlight, inFlight);
      releases.push(() => { inner(value, expected).then(saved => { inFlight -= 1; resolve(saved); }, error => { inFlight -= 1; reject(error); }); });
    });
    const cache = new LocalTreeCache(new MemoryStorage());
    let id = 0;
    const { result } = renderHook(() => useTreeSync({ treeId: initial.id, repository, cache, createOperationId: () => `op-${++id}` }));
    await waitFor(() => expect(result.current.state.status).toBe("saved"));

    act(() => { result.current.mutate(current => ({ ...current, name: "Edit one" })); });
    act(() => { result.current.mutate(current => ({ ...current, name: "Edit two" })); });
    await waitFor(() => expect(releases).toHaveLength(1));
    expect(result.current.state.tree?.name).toBe("Edit two");

    await act(async () => { releases[0](); });
    // The first save is acknowledged, but the screen keeps the newer edit while it is still on its way.
    await waitFor(() => expect(releases).toHaveLength(2));
    expect(result.current.state.tree?.name).toBe("Edit two");
    expect(result.current.state.status).toBe("saving");

    await act(async () => { releases[1](); });
    await waitFor(() => expect(result.current.state.status).toBe("saved"));
    expect(result.current.state.tree).toMatchObject({ name: "Edit two", revision: 2 });
    expect(result.current.state.conflict).toBeNull();
    expect(maxInFlight).toBe(1);
    expect((await repository.load(initial.id)).name).toBe("Edit two");
  });

  it("holds later edits while an earlier one is waiting offline, then replays them in order", async () => {
    const initial = tree();
    const repository = new ControllableRepository(initial);
    const cache = new LocalTreeCache(new MemoryStorage());
    let id = 0;
    const { result } = renderHook(() => useTreeSync({ treeId: initial.id, repository, cache, createOperationId: () => `op-${++id}` }));
    await waitFor(() => expect(result.current.state.status).toBe("saved"));
    repository.offline = true;
    act(() => { result.current.mutate(current => ({ ...current, name: "First offline" })); });
    await waitFor(() => expect(result.current.state.status).toBe("offline"));
    act(() => { result.current.mutate(current => ({ ...current, name: "Second" })); });
    await waitFor(() => expect(result.current.state.status).toBe("offline"));
    expect(cache.load().pendingOperations).toHaveLength(2);
    repository.offline = false;
    await act(async () => { await result.current.retry(); });
    await waitFor(() => expect(result.current.state.status).toBe("saved"));
    expect((await repository.load(initial.id))).toMatchObject({ name: "Second", revision: 2 });
  });

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
    // The save is resent once on load; the server answers 409 with its copy already at that revision.
    await waitFor(() => expect(result.current.state.status).toBe("saved"));
    expect(result.current.state.conflict).toBeNull();
    expect(cache.load().pendingOperations).toHaveLength(0);
    expect((await repository.load(remote.id)).revision).toBe(1);
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
  function delayedSaves(repository: ControllableRepository) {
    const releases: (() => void)[] = [];
    const inner = repository.save.bind(repository);
    const counts = { inFlight: 0, max: 0 };
    repository.save = (value, expected) => new Promise((resolve, reject) => {
      counts.inFlight += 1; counts.max = Math.max(counts.max, counts.inFlight);
      releases.push(() => { inner(value, expected).then(saved => { counts.inFlight -= 1; resolve(saved); }, error => { counts.inFlight -= 1; reject(error); }); });
    });
    return { releases, counts };
  }

  it("shows the newest local edit in a conflict found mid-queue and keeps it when replacing", async () => {
    const initial = tree();
    const repository = new ControllableRepository(initial);
    const { releases } = delayedSaves(repository);
    const cache = new LocalTreeCache(new MemoryStorage());
    let id = 0;
    const { result } = renderHook(() => useTreeSync({ treeId: initial.id, repository, cache, createOperationId: () => `op-${++id}` }));
    await waitFor(() => expect(result.current.state.status).toBe("saved"));
    act(() => { result.current.mutate(current => ({ ...current, name: "Edit one" })); });
    act(() => { result.current.mutate(current => ({ ...current, name: "Edit two" })); });
    await repository.inner.save({ ...initial, name: "Remote edit" }, 0);
    await waitFor(() => expect(releases).toHaveLength(1));
    await act(async () => { releases[0](); });
    await waitFor(() => expect(result.current.state.status).toBe("conflict"));
    expect(result.current.state.conflict?.local.name).toBe("Edit two");
    expect(result.current.state.tree?.name).toBe("Edit two");
    expect(releases).toHaveLength(1);

    await act(async () => { await result.current.resolveConflict("replace-remote"); });
    const resolving = act(async () => { await result.current.resolveConflict("replace-remote"); });
    await waitFor(() => expect(releases).toHaveLength(2));
    releases[1]();
    await resolving;
    await waitFor(() => expect(result.current.state.status).toBe("saved"));
    expect((await repository.load(initial.id)).name).toBe("Edit two");
    expect(cache.load().pendingOperations).toHaveLength(0);
  });

  it("does not send a second copy when Retry is pressed while a save is in flight", async () => {
    const initial = tree();
    const repository = new ControllableRepository(initial);
    const { releases, counts } = delayedSaves(repository);
    const cache = new LocalTreeCache(new MemoryStorage());
    const { result } = renderHook(() => useTreeSync({ treeId: initial.id, repository, cache, createOperationId: () => "op-1" }));
    await waitFor(() => expect(result.current.state.status).toBe("saved"));
    act(() => { result.current.mutate(current => ({ ...current, name: "Once" })); });
    await waitFor(() => expect(releases).toHaveLength(1));
    let retried!: Promise<void>;
    act(() => { retried = result.current.retry(); window.dispatchEvent(new Event("online")); });
    await act(async () => { releases[0](); await retried; });
    await waitFor(() => expect(result.current.state.status).toBe("saved"));
    expect(releases).toHaveLength(1);
    expect(counts.max).toBe(1);
    expect(result.current.state.conflict).toBeNull();
    expect(result.current.state.tree).toMatchObject({ name: "Once", revision: 1 });
  });

  it("sends an edit made while earlier saves are still in flight", async () => {
    const initial = tree();
    const repository = new ControllableRepository(initial);
    const { releases } = delayedSaves(repository);
    const cache = new LocalTreeCache(new MemoryStorage());
    let id = 0;
    const { result } = renderHook(() => useTreeSync({ treeId: initial.id, repository, cache, createOperationId: () => `op-${++id}` }));
    await waitFor(() => expect(result.current.state.status).toBe("saved"));
    act(() => { result.current.mutate(current => ({ ...current, name: "First" })); });
    await waitFor(() => expect(releases).toHaveLength(1));
    await act(async () => { releases[0](); });
    act(() => { result.current.mutate(current => ({ ...current, name: "Later" })); });
    await waitFor(() => expect(releases).toHaveLength(2));
    await act(async () => { releases[1](); });
    await waitFor(() => expect(result.current.state.status).toBe("saved"));
    expect(await repository.load(initial.id)).toMatchObject({ name: "Later", revision: 2 });
  });

  it("sends edits left from a previous visit once the tree loads", async () => {
    const initial = tree();
    const repository = new ControllableRepository(initial);
    const cache = new LocalTreeCache(new MemoryStorage());
    cache.enqueue({ id: "left-over", treeId: initial.id, kind: "save", expectedRevision: 0, tree: { ...initial, name: "From last time", revision: 1 }, createdAt: initial.updatedAt });
    const { result } = renderHook(() => useTreeSync({ treeId: initial.id, repository, cache }));
    await waitFor(() => expect(result.current.state.status).toBe("saved"));
    expect(await repository.load(initial.id)).toMatchObject({ name: "From last time", revision: 1 });
    expect(cache.load().pendingOperations).toHaveLength(0);
  });

  it("keeps a conflict on screen when the browser comes back online", async () => {
    const initial = tree();
    const repository = new ControllableRepository(initial);
    const cache = new LocalTreeCache(new MemoryStorage());
    const { result } = renderHook(() => useTreeSync({ treeId: initial.id, repository, cache, createOperationId: () => "op-1" }));
    await waitFor(() => expect(result.current.state.status).toBe("saved"));
    await repository.inner.save({ ...initial, name: "Remote edit" }, 0);
    act(() => { result.current.mutate(current => ({ ...current, name: "Local edit" })); });
    await waitFor(() => expect(result.current.state.status).toBe("conflict"));
    await act(async () => { window.dispatchEvent(new Event("online")); });
    expect(result.current.state.status).toBe("conflict");
    expect(cache.load().pendingOperations).toHaveLength(1);
  });
});
