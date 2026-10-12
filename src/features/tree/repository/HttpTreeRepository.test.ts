import { describe, expect, it, vi } from "vitest";
import { createJokowiDemoTree } from "../demoData";
import { toOnlineTree } from "../domain/serialization";
import { HttpTreeRepository } from "./HttpTreeRepository";

const { excludedDataUrlPhotoIds: _excluded, ...tree } = toOnlineTree(createJokowiDemoTree(), { ownerId: "owner-1", revision: 2 });
void _excluded;
const reply = (status: number, body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));

describe("HttpTreeRepository", () => {
  it("calls the trees API with the session cookie and JSON bodies", async () => {
    const fetch = vi.fn((...args: [string, RequestInit?]) => { void args; return reply(200, { tree: { ...tree, revision: 3 } }); });
    const repository = new HttpTreeRepository(fetch as typeof globalThis.fetch);
    const saved = await repository.save(tree, 2);
    expect(saved.revision).toBe(3);
    const [path, init] = fetch.mock.calls[0];
    expect(path).toBe(`/api/trees/${tree.id}`);
    expect(init).toMatchObject({ method: "PUT", credentials: "same-origin", headers: { "Content-Type": "application/json" } });
    expect(JSON.parse(String(init?.body))).toEqual({ tree, expectedRevision: 2 });
  });

  it("lists, loads, creates and deletes", async () => {
    const fetch = vi.fn((path: string, init?: RequestInit) => {
      if (init?.method === "POST") return reply(201, { tree });
      if (init?.method === "DELETE") return reply(200, { ok: true });
      return path === "/api/trees" ? reply(200, { trees: [tree] }) : reply(200, { tree });
    });
    const repository = new HttpTreeRepository(fetch as typeof globalThis.fetch);
    expect(await repository.listOwned()).toHaveLength(1);
    expect((await repository.load("a b")).id).toBe(tree.id);
    expect(fetch).toHaveBeenCalledWith("/api/trees/a%20b", expect.anything());
    expect((await repository.create(tree)).id).toBe(tree.id);
    await repository.delete(tree.id);
    expect(fetch).toHaveBeenLastCalledWith(`/api/trees/${tree.id}`, expect.objectContaining({ method: "DELETE" }));
  });

  it.each([
    [409, "conflict"], [404, "not-found"], [401, "permission-denied"], [403, "permission-denied"],
    [400, "invalid-data"], [413, "invalid-data"], [429, "offline"], [500, "offline"], [503, "offline"],
  ])("maps HTTP %i to %s", async (status, code) => {
    const repository = new HttpTreeRepository((() => reply(status, { error: { code: "x", message: "Server says no." } })) as typeof globalThis.fetch);
    await expect(repository.load("t")).rejects.toMatchObject({ code, message: "Server says no." });
  });

  it("treats an unreachable server as offline so edits stay queued", async () => {
    const repository = new HttpTreeRepository((() => Promise.reject(new TypeError("Failed to fetch"))) as typeof globalThis.fetch);
    await expect(repository.save(tree, 2)).rejects.toMatchObject({ code: "offline" });
  });
});
