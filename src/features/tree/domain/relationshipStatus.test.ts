import { describe, expect, it } from "vitest";
import { addRelationship, emptyPerson, newTree, type FamilyTree, type Gender } from "../model";
import { RELATIONSHIP_STATUSES, STATUS_GROUPS, relationshipToStatus, statusByKey, statusToRelationship } from "./relationshipStatus";

const treeWith = (genders: Record<string, Gender>): FamilyTree => ({
  ...newTree(),
  people: Object.entries(genders).map(([id, gender]) => ({ ...emptyPerson(), id, name: id, gender })),
});

describe("relationship statuses", () => {
  it("offers the 24 wizard statuses across four groups", () => {
    expect(RELATIONSHIP_STATUSES).toHaveLength(24);
    expect(new Set(RELATIONSHIP_STATUSES.map(status => status.key)).size).toBe(24);
    expect(STATUS_GROUPS.map(group => RELATIONSHIP_STATUSES.filter(status => status.group === group).length)).toEqual([6, 7, 4, 7]);
    expect(() => statusByKey("cousin" as never)).toThrow();
  });

  it("turns a parent status into an edge from the new person to the anchor", () => {
    expect(statusToRelationship("stepMother", "anchor", "new")).toEqual({ type: "parent-child", from: "new", to: "anchor", details: { kind: "step" }, gender: "female" });
  });

  it("turns a child status into an edge from the anchor to the new person", () => {
    expect(statusToRelationship("ward", "anchor", "new")).toEqual({ type: "parent-child", from: "anchor", to: "new", details: { kind: "guardian" }, gender: "unspecified" });
  });

  it("carries the partner status and marriage date", () => {
    expect(statusToRelationship("exWife", "anchor", "new", "1999-02-03")).toEqual({ type: "partner", from: "anchor", to: "new", details: { status: "ex", marriedOn: "1999-02-03" }, gender: "female" });
  });

  it("round-trips every status through the model for gendered people", () => {
    for (const status of RELATIONSHIP_STATUSES) {
      const plan = statusToRelationship(status.key, "anchor", "new");
      const tree = addRelationship(treeWith({ anchor: "unspecified", new: plan.gender }), plan.type, plan.from, plan.to, plan.details);
      expect(relationshipToStatus(tree, tree.relationships[0], "anchor")).toBe(status.key);
    }
  });

  it("describes the same edge from either side", () => {
    const tree = addRelationship(treeWith({ parent: "female", child: "male" }), "parent-child", "parent", "child", { kind: "adoptive" });
    expect(relationshipToStatus(tree, tree.relationships[0], "child")).toBe("adoptiveMother");
    expect(relationshipToStatus(tree, tree.relationships[0], "parent")).toBe("adoptiveSon");
    expect(relationshipToStatus(tree, tree.relationships[0], "stranger")).toBeNull();
  });

  it("uses the first matching status when no neutral one exists", () => {
    const tree = addRelationship(treeWith({ a: "unspecified", b: "unspecified" }), "partner", "a", "b", { status: "married" });
    expect(relationshipToStatus(tree, tree.relationships[0], "a")).toBe("wife");
  });
});
