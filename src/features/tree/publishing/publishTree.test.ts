import { describe, expect, it, vi } from "vitest";
import type { OnlineTree } from "../domain/onlineTypes";
import type { PublicationRepository } from "./PublicationRepository";
import { publishTree, regeneratePublicId, unpublishTree, updatePublishedTree } from "./publishTree";

const tree = (overrides: Partial<OnlineTree> = {}): OnlineTree => ({
  id: "tree-one", ownerId: "owner", name: "Family", visibility: "private",
  publicId: null, revision: 2, schemaVersion: 2,
  createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
  publishedRevision: null, people: [], relationships: [], ...overrides,
});

function repository(events: string[]): PublicationRepository {
  return {
    publish: vi.fn(async (value, publicId) => {
      events.push(`publish:${publicId}`);
      return { ...value, visibility: "unlisted", publicId, revision: value.revision + 1, publishedRevision: value.revision + 1 };
    }),
    disable: vi.fn(async value => {
      events.push("disable");
      return { ...value, visibility: "private", publicId: null, revision: value.revision + 1, publishedRevision: null };
    }),
    loadPublic: vi.fn(async () => null),
    getPublication: vi.fn(async () => null),
  };
}

describe("publication lifecycle", () => {
  it("publishes with an opaque generated link", async () => {
    const events: string[] = [];
    const result = await publishTree(repository(events), tree());
    expect(result.publicId).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(result.publicId).not.toContain(result.id);
    expect(events[0]).toContain("publish:");
  });

  it("updates an existing public snapshot without changing its link", async () => {
    const events: string[] = [];
    const current = tree({ visibility: "unlisted", publicId: "existing_public_id_1234", publishedRevision: 1 });
    expect((await updatePublishedTree(repository(events), current)).publicId).toBe(current.publicId);
    expect(events).toEqual(["publish:existing_public_id_1234"]);
  });

  it("revokes a link and leaves a private tree alone", async () => {
    const events: string[] = [];
    expect((await unpublishTree(repository(events), tree({ visibility: "unlisted", publicId: "old_public_identifier_12" }))).visibility).toBe("private");
    expect(events).toEqual(["disable"]);
    const unshared = tree();
    expect(await unpublishTree(repository(events), unshared)).toBe(unshared);
    expect(events).toEqual(["disable"]);
  });

  it("moves to a new link in one step", async () => {
    const events: string[] = [];
    const current = tree({ visibility: "unlisted", publicId: "old_public_identifier_12", publishedRevision: 2 });
    const result = await regeneratePublicId(repository(events), current);
    expect(events).toHaveLength(1);
    expect(result.publicId).not.toBe(current.publicId);
    await expect(regeneratePublicId(repository(events), tree())).rejects.toThrow(/Publish this family tree/);
  });
});
