import { describe, expect, it, vi } from "vitest";
import type { OnlineTree } from "../domain/onlineTypes";
import { HttpPublicationRepository } from "./HttpPublicationRepository";

const reply = (status: number, body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));
const tree = { id: "tree-1", revision: 4 } as OnlineTree;
const snapshot = {
  publicId: "public_identifier_abcdefghij", name: "Keluarga Uji", schemaVersion: 2, publishedRevision: 5, publishedAt: "2026-10-12T00:00:00.000Z",
  people: [{ id: "budi", name: "Budi", gender: "male", birthDate: "", deathDate: "", birthOrder: null, residence: "", notes: "", photoUrl: "", sortOrder: 0 }],
  relationships: [],
};

describe("HttpPublicationRepository", () => {
  it("publishes with the tree's revision and revokes through the API", async () => {
    const fetch = vi.fn((...args: [string, RequestInit?]) => { void args; return reply(200, { tree: { ...tree, revision: 5 } }); });
    const repository = new HttpPublicationRepository(fetch as typeof globalThis.fetch);
    expect((await repository.publish(tree, "public_identifier_abcdefghij")).revision).toBe(5);
    expect(fetch.mock.calls[0][0]).toBe("/api/trees/tree-1/publication");
    expect(fetch.mock.calls[0][1]).toMatchObject({ method: "PUT", credentials: "same-origin" });
    expect(JSON.parse(String(fetch.mock.calls[0][1]?.body))).toEqual({ publicId: "public_identifier_abcdefghij", expectedRevision: 4 });
    await repository.disable(tree);
    expect(fetch.mock.calls[1][1]).toMatchObject({ method: "DELETE" });
    expect(JSON.parse(String(fetch.mock.calls[1][1]?.body))).toEqual({ expectedRevision: 4 });
  });

  it("surfaces the server's message when publishing fails", async () => {
    const repository = new HttpPublicationRepository((() => reply(409, { error: { message: "Reload it before sharing." } })) as typeof globalThis.fetch);
    await expect(repository.publish(tree, "public_identifier_abcdefghij")).rejects.toThrow("Reload it before sharing.");
  });

  it("loads a public snapshot without sending cookies", async () => {
    const fetch = vi.fn((...args: [string, RequestInit?]) => { void args; return reply(200, { snapshot }); });
    const loaded = await new HttpPublicationRepository(fetch as typeof globalThis.fetch).loadPublic(snapshot.publicId);
    expect(fetch.mock.calls[0][1]).toMatchObject({ credentials: "omit" });
    expect(loaded).toMatchObject({ publicId: snapshot.publicId, name: "Keluarga Uji", publishedRevision: 5, tree: { people: [{ id: "budi", name: "Budi", gender: "male" }] } });
  });

  it("returns null for unavailable links and network errors alike", async () => {
    expect(await new HttpPublicationRepository((() => reply(404, { error: {} })) as typeof globalThis.fetch).loadPublic("x")).toBeNull();
    expect(await new HttpPublicationRepository((() => Promise.reject(new TypeError("offline"))) as typeof globalThis.fetch).loadPublic("x")).toBeNull();
  });
});
