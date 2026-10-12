import { describe, expect, it } from "vitest";
import type { WorkspaceData } from "../model";
import { planMigration } from "./planMigration";

const workspace: WorkspaceData = { version: 1, activeTreeId: "tree-a", trees: [
  { id: "tree-a", name: "Family A", updatedAt: "2026-01-01T00:00:00.000Z", people: [
    { id: "person-a", name: "A", gender: "unspecified", birthDate: "", deathDate: "", birthOrder: null, residence: "", notes: "", photoUrl: "", photo: "data:image/png;base64,abc" },
    { id: "person-b", name: "B", gender: "unspecified", birthDate: "", deathDate: "", birthOrder: null, residence: "", notes: "", photoUrl: "https://example.test/b.jpg" },
  ], relationships: [{ id: "rel-a", type: "parent-child", from: "person-a", to: "person-b", kind: "biological", status: null, marriedOn: "" }] },
  { id: "tree-b", name: "Family B", updatedAt: "2026-01-02T00:00:00.000Z", people: [], relationships: [] },
] };

describe("planMigration", () => {
  it("reports exact counts and writes; embedded photos upload afterwards instead of being excluded", () => {
    const plan = planMigration(workspace, { remoteIdsByLocalId: {}, completedTreeIds: [] }, { ownerId: "owner", idFactory: () => "remote" });
    expect(plan.totals).toEqual({ treeCount: 2, personCount: 2, relationshipCount: 1, excludedPhotoCount: 0, estimatedWrites: 7 });
    expect(plan.items[0].excludedPhotoIds).toEqual([]);
  });

  it("keeps existing mappings stable and supports selection", () => {
    const plan = planMigration(workspace, { remoteIdsByLocalId: { "tree-b": "stable-b" }, completedTreeIds: [] }, { selectedTreeIds: ["tree-b"], idFactory: () => "new-id" });
    expect(plan.items).toHaveLength(1);
    expect(plan.items[0].remoteTreeId).toBe("stable-b");
  });

  it("reports validation errors before remote work", () => {
    const invalid = structuredClone(workspace);
    invalid.trees[0].people[1].id = "person-a";
    const plan = planMigration(invalid, { remoteIdsByLocalId: {}, completedTreeIds: [] }, { idFactory: () => "remote" });
    expect(plan.items[0].validationErrors[0]).toMatch(/unique/i);
  });
});
