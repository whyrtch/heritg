import { describe, expect, it, vi } from "vitest";
import type { OnlineTree } from "../domain/onlineTypes";
import type { PublicationRepository } from "./PublicationRepository";
import { publishTree, regeneratePublicId, unpublishTree, updatePublishedTree } from "./publishTree";

const tree = (overrides: Partial<OnlineTree> = {}): OnlineTree => ({
  id: "tree-one", ownerId: "owner", name: "Family", visibility: "private",
  publicId: null, revision: 2, schemaVersion: 1,
  createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
  publishedRevision: null, people: [], relationships: [], ...overrides,
});

function repository(events: string[]): PublicationRepository {
  return {
    publish: vi.fn(async (value, publicId, previous) => {
      events.push(`publish:${publicId}:${previous ?? "none"}`);
      return { ...value, visibility: "unlisted", publicId, revision: value.revision + 1, publishedRevision: value.revision + 1 };
    }),
    disable: vi.fn(async value => {
      events.push("disable");
      return { ...value, visibility: "private", publicId: null, revision: value.revision + 1, publishedRevision: null };
    }),
    cleanupDisabled: vi.fn(async publicId => { events.push(`cleanup:${publicId}`); }),
    loadPublic: vi.fn(async () => null),
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
  });

  it("disables access before cleanup and reports deferred cleanup", async () => {
    const events: string[] = [];
    const repo = repository(events);
    vi.mocked(repo.cleanupDisabled).mockRejectedValueOnce(new Error("offline"));
    const result = await unpublishTree(repo, tree({ visibility: "unlisted", publicId: "old_public_identifier_12" }));
    expect(events[0]).toBe("disable");
    expect(result.tree.visibility).toBe("private");
    expect(result.cleanupPending).toBe(true);
  });

  it("creates and switches to the new link before cleaning the old one", async () => {
    const events: string[] = [];
    const current = tree({ visibility: "unlisted", publicId: "old_public_identifier_12", publishedRevision: 2 });
    const result = await regeneratePublicId(repository(events), current);
    expect(events[0]).toMatch(/^publish:/);
    expect(events[0]).toContain(":old_public_identifier_12");
    expect(events[1]).toBe("cleanup:old_public_identifier_12");
    expect(result.tree.publicId).not.toBe(current.publicId);
  });
});
