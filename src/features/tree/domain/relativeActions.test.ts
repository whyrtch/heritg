import { describe, expect, it } from "vitest";
import { addRelationship, emptyPerson, newTree, type FamilyTree } from "../model";
import { addRelative, familyRows, linkCandidates, partnersOf, removeRelationship, setMarriedOn, setRelationshipStatus } from "./relativeActions";

const base = (): FamilyTree => {
  const tree: FamilyTree = { ...newTree(), people: [{ ...emptyPerson(), id: "budi", name: "Budi", gender: "male" }, { ...emptyPerson(), id: "sari", name: "Sari", gender: "female" }, { ...emptyPerson(), id: "lain", name: "Lain" }] };
  return addRelationship(tree, "partner", "budi", "sari");
};

describe("relative actions", () => {
  it("adds a new parent with the gender the status implies", () => {
    const { tree, personId } = addRelative(base(), "budi", { status: "mother", person: { ...emptyPerson(), id: "ibu", name: "Ibu Budi" } });
    expect(personId).toBe("ibu");
    expect(tree.people.find(p => p.id === "ibu")!.gender).toBe("female");
    expect(tree.relationships.at(-1)).toMatchObject({ type: "parent-child", from: "ibu", to: "budi", kind: "biological" });
  });

  it("adds a child with an optional co-parent and the same kind", () => {
    const { tree } = addRelative(base(), "budi", { status: "adoptiveDaughter", person: { ...emptyPerson(), id: "ani", name: "Ani" }, coParentId: "sari" });
    const links = tree.relationships.filter(r => r.to === "ani");
    expect(links.map(r => [r.from, r.kind])).toEqual([["budi", "adoptive"], ["sari", "adoptive"]]);
    expect(tree.people.find(p => p.id === "ani")!.gender).toBe("female");
  });

  it("keeps a gender the user chose and records the marriage date", () => {
    const { tree } = addRelative(base(), "lain", { status: "partner", person: { ...emptyPerson(), id: "p", name: "P", gender: "male" }, marriedOn: "2001-02-03" });
    expect(tree.people.find(p => p.id === "p")!.gender).toBe("male");
    expect(tree.relationships.at(-1)).toMatchObject({ type: "partner", status: "partner", marriedOn: "2001-02-03" });
  });

  it("connects an existing person and refuses duplicates", () => {
    const { tree } = addRelative(base(), "budi", { status: "son", existingId: "lain" });
    expect(tree.relationships.at(-1)).toMatchObject({ from: "budi", to: "lain" });
    expect(() => addRelative(tree, "budi", { status: "son", existingId: "lain" })).toThrow(/already exists/);
    expect(() => addRelative(tree, "budi", { status: "son" })).toThrow();
  });

  it("changes a relationship's status in place, keeping its id", () => {
    const tree = base();
    const id = tree.relationships[0].id;
    const next = setRelationshipStatus(tree, id, "budi", "exWife", "1990-01-01");
    expect(next.relationships).toHaveLength(1);
    expect(next.relationships[0]).toMatchObject({ id, type: "partner", status: "ex", marriedOn: "1990-01-01" });
    const flipped = setRelationshipStatus(tree, id, "budi", "mother");
    expect(flipped.relationships[0]).toMatchObject({ id, type: "parent-child", from: "sari", to: "budi" });
  });

  it("edits the marriage date and removes relationships", () => {
    const tree = base();
    const id = tree.relationships[0].id;
    expect(setMarriedOn(tree, id, "1999-09-09").relationships[0].marriedOn).toBe("1999-09-09");
    expect(removeRelationship(tree, id).relationships).toEqual([]);
  });

  it("lists family rows, link candidates and partners", () => {
    const tree = base();
    expect(familyRows(tree, "budi").map(row => [row.person.id, row.status])).toEqual([["sari", "wife"]]);
    expect(linkCandidates(tree, "budi").map(p => p.id)).toEqual(["lain"]);
    expect(partnersOf(tree, "budi").map(p => p.id)).toEqual(["sari"]);
  });
});
