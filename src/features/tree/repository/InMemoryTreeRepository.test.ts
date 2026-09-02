import { beforeEach, describe, expect, it } from "vitest";
import { createJokowiDemoTree } from "../demoData";
import type { OnlineTree } from "../domain/onlineTypes";
import { toOnlineTree } from "../domain/serialization";
import { InMemoryTreeRepository } from "./InMemoryTreeRepository";
import { TreeRepositoryError, type TreeRepository } from "./TreeRepository";

function online(ownerId = "owner-1", id = "tree-1"): OnlineTree {
  const serialized = toOnlineTree({ ...createJokowiDemoTree(), id }, { ownerId, revision: 0 });
  const { excludedDataUrlPhotoIds: _excludedDataUrlPhotoIds, ...tree } = serialized;
  void _excludedDataUrlPhotoIds;
  return tree;
}

describe("TreeRepository contract: in-memory", () => {
  let repository: TreeRepository;
  beforeEach(() => { repository = new InMemoryTreeRepository(); });

  it("filters owned trees and returns defensive copies", async () => {
    await repository.create(online("owner-1", "one"));
    await repository.create(online("owner-2", "two"));
    const result = await repository.listOwned("owner-1");
    expect(result.map(tree => tree.id)).toEqual(["one"]);
    result[0].name = "Changed outside repository";
    expect((await repository.load("one")).name).not.toBe("Changed outside repository");
  });

  it("increments revisions only when the expected revision matches", async () => {
    const created = await repository.create(online());
    const saved = await repository.save({ ...created, name: "Updated" }, 0);
    expect(saved.revision).toBe(1);
    await expect(repository.save({ ...saved, name: "Stale" }, 0)).rejects.toMatchObject({ code: "conflict" });
    expect((await repository.load(created.id)).name).toBe("Updated");
  });

  it("does not partially mutate when a save fails", async () => {
    const created = await repository.create(online());
    await expect(repository.save({ ...created, ownerId: "intruder", people: [] }, 0)).rejects.toBeInstanceOf(TreeRepositoryError);
    expect((await repository.load(created.id)).people).toHaveLength(created.people.length);
  });

  it("reports stable errors for missing records", async () => {
    await expect(repository.load("missing")).rejects.toMatchObject({ code: "not-found" });
    await expect(repository.delete("missing")).rejects.toMatchObject({ code: "not-found" });
  });
});
