import React from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Workspace } from "./Workspace";
import { createJokowiDemoTree } from "./demoData";
import { emptyPerson, newTree, type FamilyTree } from "./model";
import { toOnlineTree } from "./domain/serialization";
import { TREE_CACHE_STORAGE_KEY, type LocalTreeCacheData } from "./repository/LocalTreeCache";
import { PHOTO_QUEUE_KEY } from "./sync/photoQueue";
import { setLanguage } from "@/i18n";

const auth = vi.hoisted(() => ({ user: null as { uid: string } | null }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));
vi.mock("@/features/auth/useAuth", () => ({ useAuth: () => ({ user: auth.user, status: auth.user ? "authenticated" : "unauthenticated", signOut: vi.fn() }) }));

const person = (id: string) => ({ ...emptyPerson(), id, name: id });
const budi: FamilyTree = { ...newTree("Keluarga Budi"), id: "local-budi", people: [person("budi")], updatedAt: "2026-10-11T08:00:00.000Z" };
const sari: FamilyTree = { ...newTree("Keluarga Sari"), id: "local-sari", people: [person("sari"), person("ani")], updatedAt: "2026-10-11T08:00:00.000Z" };
const REMOTE = "remote-budi";

/** Budi is synced (mapping, cached copy, a waiting save and a waiting photo); Sari is local only. */
const seed = (activeTreeId = budi.id) => {
  const { excludedDataUrlPhotoIds: _x, ...online } = toOnlineTree({ ...budi, id: REMOTE }, { ownerId: "owner", revision: 2 });
  void _x;
  const cache: LocalTreeCacheData = {
    version: 2,
    workspace: { version: 1, activeTreeId, trees: [createJokowiDemoTree(), budi, sari] },
    onlineTrees: { [REMOTE]: online, other: { ...online, id: "other" } },
    lastSynchronizedRevisions: { [REMOTE]: 2, other: 1 },
    pendingOperations: [{ id: "op-1", treeId: REMOTE, kind: "save", expectedRevision: 2, tree: online, createdAt: "2026-10-11T09:00:00.000Z" }],
    migration: { completedTreeIds: [budi.id], remoteIdsByLocalId: { [budi.id]: REMOTE } },
  };
  window.localStorage.setItem(TREE_CACHE_STORAGE_KEY, JSON.stringify(cache));
  window.localStorage.setItem(PHOTO_QUEUE_KEY, JSON.stringify([
    { id: "p1", treeId: REMOTE, personId: "budi", action: "upload", dataUrl: "data:image/webp;base64,AAAA" },
    { id: "p2", treeId: "other", personId: "x", action: "delete" },
  ]));
};
const stored = () => JSON.parse(window.localStorage.getItem(TREE_CACHE_STORAGE_KEY)!) as LocalTreeCacheData;

type Reply = { status: number } | "offline";
let deleteReply: Reply;
const fetchMock = vi.fn();

const openDelete = async (name: string) => {
  render(<Workspace />);
  await screen.findByRole("button", { name: "Lihat kumpulan silsilah" });
  fireEvent.click(screen.getByRole("button", { name: "Lihat kumpulan silsilah" }));
  fireEvent.click(screen.getByRole("button", { name: `${name}: Atur Silsilah` }));
  fireEvent.click(screen.getByRole("menuitem", { name: "Hapus" }));
  return screen.getByRole("dialog", { name: `Hapus ${name}?` });
};

describe("Workspace delete a tree", () => {
  beforeEach(() => {
    window.localStorage.clear();
    deleteReply = { status: 200 };
    fetchMock.mockReset();
    // The tree never loads (unreachable server), so the cached copy and its waiting edit stay in place.
    fetchMock.mockImplementation(async (_path: string, init?: RequestInit) => {
      if (init?.method !== "DELETE") throw new TypeError("offline");
      if (deleteReply === "offline") throw new TypeError("offline");
      return new Response(JSON.stringify(deleteReply.status < 300 ? { ok: true } : { error: { message: "x" } }), { status: deleteReply.status });
    });
    vi.stubGlobal("fetch", fetchMock);
    auth.user = { uid: "owner" };
  });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); setLanguage("id"); window.localStorage.clear(); auth.user = null; });

  it("deletes a synced tree on the server first, then removes every local trace and picks another tree", async () => {
    seed();
    const dialog = await openDelete("Keluarga Budi");
    expect(within(dialog).getByText("1 orang dan 0 hubungan bakal dihapus dari akunmu dan perangkat ini. Link publiknya juga berhenti jalan.")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Hapus silsilah" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Hapus Keluarga Budi?" })).not.toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledWith(`/api/trees/${REMOTE}`, expect.objectContaining({ method: "DELETE" }));

    const after = stored();
    expect(after.workspace?.trees.map(tree => tree.id)).not.toContain(budi.id);
    expect(after.workspace?.activeTreeId).toBe(sari.id);
    expect(Object.keys(after.onlineTrees)).toEqual(["other"]);
    expect(Object.keys(after.lastSynchronizedRevisions)).toEqual(["other"]);
    expect(after.pendingOperations).toEqual([]);
    expect(after.migration).toEqual({ completedTreeIds: [], remoteIdsByLocalId: {} });
    expect(JSON.parse(window.localStorage.getItem(PHOTO_QUEUE_KEY)!).map((task: { id: string }) => task.id)).toEqual(["p2"]);
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Keluarga Sari" })).toBeInTheDocument();

    // The deleted tree is never saved again: nothing but the one DELETE reached a write endpoint.
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method && init.method !== "GET" && init.method !== "DELETE")).toEqual([]);
    expect(stored().pendingOperations).toEqual([]);
    expect(Object.keys(stored().onlineTrees)).toEqual(["other"]);
  });

  it("keeps every byte and shows a message when the delete fails offline", async () => {
    seed();
    deleteReply = "offline";
    const photosBefore = window.localStorage.getItem(PHOTO_QUEUE_KEY);
    const dialog = await openDelete("Keluarga Budi");
    // Opening the app re-saves the (normalised) workspace; compare from here.
    const cacheBefore = window.localStorage.getItem(TREE_CACHE_STORAGE_KEY);
    fireEvent.click(within(dialog).getByRole("button", { name: "Hapus silsilah" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Silsilah ini perlu online buat dihapus. Coba lagi nanti.");
    expect(window.localStorage.getItem(TREE_CACHE_STORAGE_KEY)).toBe(cacheBefore);
    expect(window.localStorage.getItem(PHOTO_QUEUE_KEY)).toBe(photosBefore);
    // The dialog stays usable and can be cancelled.
    expect(within(dialog).getByRole("button", { name: "Hapus silsilah" })).toBeEnabled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Batal" }));
    expect(screen.queryByRole("dialog", { name: "Hapus Keluarga Budi?" })).not.toBeInTheDocument();
    expect(window.localStorage.getItem(TREE_CACHE_STORAGE_KEY)).toBe(cacheBefore);
  });

  it("keeps everything on a server error and shows the generic message", async () => {
    seed();
    deleteReply = { status: 403 };
    const dialog = await openDelete("Keluarga Budi");
    const cacheBefore = window.localStorage.getItem(TREE_CACHE_STORAGE_KEY);
    fireEvent.click(within(dialog).getByRole("button", { name: "Hapus silsilah" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Silsilah belum bisa dihapus. Coba lagi nanti.");
    expect(window.localStorage.getItem(TREE_CACHE_STORAGE_KEY)).toBe(cacheBefore);
  });

  it("treats not-found as already deleted", async () => {
    seed();
    deleteReply = { status: 404 };
    const dialog = await openDelete("Keluarga Budi");
    fireEvent.click(within(dialog).getByRole("button", { name: "Hapus silsilah" }));
    await waitFor(() => expect(stored().workspace?.trees.map(tree => tree.id)).not.toContain(budi.id));
    expect(stored().migration.remoteIdsByLocalId).toEqual({});
    expect(stored().pendingOperations).toEqual([]);
  });

  it("will not delete a synced tree while signed out", async () => {
    seed();
    auth.user = null;
    const dialog = await openDelete("Keluarga Budi");
    const cacheBefore = window.localStorage.getItem(TREE_CACHE_STORAGE_KEY);
    fireEvent.click(within(dialog).getByRole("button", { name: "Hapus silsilah" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Masuk dulu buat menghapus silsilah yang tersinkron.");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(TREE_CACHE_STORAGE_KEY)).toBe(cacheBefore);
  });

  it("removes a local-only tree from this device without calling the server", async () => {
    seed();
    const dialog = await openDelete("Keluarga Sari");
    expect(within(dialog).getByText("2 orang dan 0 hubungan bakal dihapus dari perangkat ini.")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Hapus silsilah" }));
    await waitFor(() => expect(stored().workspace?.trees.map(tree => tree.id)).not.toContain(sari.id));
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "DELETE")).toBe(false);
    // Deleting a tree that was not the active one leaves the active tree alone, and the synced data intact.
    expect(stored().workspace?.activeTreeId).toBe(budi.id);
    expect(Object.keys(stored().onlineTrees)).toContain(REMOTE);
    expect(stored().migration.remoteIdsByLocalId).toEqual({ [budi.id]: REMOTE });
  });

  it("falls back to the example tree when the last own tree is deleted", async () => {
    seed(sari.id);
    window.localStorage.setItem(TREE_CACHE_STORAGE_KEY, JSON.stringify({ ...stored(), workspace: { version: 1, activeTreeId: sari.id, trees: [createJokowiDemoTree(), sari] }, migration: { completedTreeIds: [], remoteIdsByLocalId: {} } }));
    const dialog = await openDelete("Keluarga Sari");
    fireEvent.click(within(dialog).getByRole("button", { name: "Hapus silsilah" }));
    expect(await screen.findByText("Keluarga Joko Widodo")).toBeInTheDocument();
    expect(stored().workspace?.trees.map(tree => tree.name)).toEqual(["Keluarga Joko Widodo"]);
  });

  it("offers no Hapus on the example tree", async () => {
    seed();
    render(<Workspace />);
    await screen.findByRole("button", { name: "Lihat kumpulan silsilah" });
    fireEvent.click(screen.getByRole("button", { name: "Lihat kumpulan silsilah" }));
    fireEvent.click(screen.getByRole("button", { name: "Keluarga Joko Widodo: Atur Silsilah" }));
    expect(screen.queryByRole("menuitem", { name: "Hapus" })).not.toBeInTheDocument();
  });
});
