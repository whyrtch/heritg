import { describe, expect, it, vi } from "vitest";
import type { WorkspaceData } from "../model";
import { InMemoryTreeRepository } from "../repository/InMemoryTreeRepository";
import { TreeRepositoryError, type TreeRepository } from "../repository/TreeRepository";
import { planMigration } from "./planMigration";
import { runMigration } from "./runMigration";
import type { MigrationMappings, MigrationStateStore } from "./types";

const source: WorkspaceData = { version: 1, activeTreeId: "local-a", trees: [{
  id: "local-a", name: "Local family", updatedAt: "2026-01-01T00:00:00.000Z",
  people: [{ id: "person-a", firstName: "A", lastName: "", gender: "unspecified", birthDate: "", deathDate: "", notes: "", photoUrl: "", photo: "data:image/png;base64,old" }], relationships: [],
}] };

class MemoryState implements MigrationStateStore {
  value: MigrationMappings = { remoteIdsByLocalId: {}, completedTreeIds: [] };
  saves: MigrationMappings[] = [];
  load() { return structuredClone(this.value); }
  save(value: MigrationMappings) { this.value = structuredClone(value); this.saves.push(structuredClone(value)); }
}

describe("runMigration", () => {
  it("persists IDs before upload, verifies, and is repeat-run idempotent", async () => {
    const repository = new InMemoryTreeRepository();
    const create = vi.spyOn(repository, "create");
    const state = new MemoryState();
    const plan = planMigration(source, state.load(), { ownerId: "owner", idFactory: () => "remote-a" });

    const first = await runMigration(plan, repository, state);
    expect(state.saves[0].remoteIdsByLocalId["local-a"]).toBe("remote-a");
    expect(first.failed).toEqual([]);
    expect(first.completedTreeIds).toContain("local-a");
    expect((await repository.load("remote-a")).people[0].photoUrl).toBe("");

    const repeatPlan = planMigration(source, state.load(), { ownerId: "owner", idFactory: () => "different" });
    await runMigration(repeatPlan, repository, state);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("resumes an interrupted upload that already exists remotely", async () => {
    const seedPlan = planMigration(source, { remoteIdsByLocalId: {}, completedTreeIds: [] }, { ownerId: "owner", idFactory: () => "remote-a" });
    const repository = new InMemoryTreeRepository();
    const state = new MemoryState();
    await runMigration(seedPlan, repository, state);
    state.value.completedTreeIds = [];

    const resumed = await runMigration(planMigration(source, state.load(), { ownerId: "owner" }), repository, state);
    expect(resumed.failed).toEqual([]);
    expect(resumed.completedTreeIds).toContain("local-a");
  });

  it("preserves local source and does not mark failed verification complete", async () => {
    const original = JSON.stringify(source);
    const base = new InMemoryTreeRepository();
    const repository: TreeRepository = {
      ...base,
      listOwned: uid => base.listOwned(uid), delete: id => base.delete(id), save: (tree, revision) => base.save(tree, revision), create: tree => base.create(tree),
      load: async () => { throw new TreeRepositoryError("offline", "Offline during verification."); },
    };
    const state = new MemoryState();
    const result = await runMigration(planMigration(source, state.load(), { ownerId: "owner", idFactory: () => "remote-a" }), repository, state);
    expect(result.failed[0].error).toMatch(/verification|offline/i);
    expect(result.completedTreeIds).not.toContain("local-a");
    expect(JSON.stringify(source)).toBe(original);
    expect(state.value.remoteIdsByLocalId["local-a"]).toBe("remote-a");
  });
});
