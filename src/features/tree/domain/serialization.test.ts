import { describe, expect, it } from "vitest";
import { createJokowiDemoTree } from "../demoData";
import { newTree, type FamilyTree } from "../model";
import { fromOnlineTree, toOnlineTree } from "./serialization";

describe("online tree serialization", () => {
  it("maps stable IDs and online metadata exactly", () => {
    const local = createJokowiDemoTree();
    local.people[0].photoUrl = "https://images.example.test/lamidi.jpg";
    const online = toOnlineTree(local, { ownerId: "owner-1", revision: 4, visibility: "unlisted", publicId: "public-1" });

    expect(online).toMatchObject({ id: local.id, ownerId: "owner-1", revision: 4, schemaVersion: 1, visibility: "unlisted", publicId: "public-1" });
    expect(online.people[0]).toMatchObject({ id: "lamidi", photoUrl: "https://images.example.test/lamidi.jpg", sortOrder: 0 });
    expect(online.relationships[0]).toMatchObject({ id: "partner-lamidi-painem", fromPersonId: "lamidi", toPersonId: "painem" });
    expect(fromOnlineTree(online)).toMatchObject({
      id: local.id,
      name: local.name,
      people: local.people.map(person => ({
        id: person.id,
        firstName: person.firstName,
        lastName: person.lastName,
        gender: person.gender,
        birthDate: person.birthDate,
        deathDate: person.deathDate,
        notes: person.notes,
        photoUrl: person.photoUrl,
      })),
      relationships: local.relationships,
      updatedAt: local.updatedAt,
    });
  });

  it("excludes legacy embedded photos without losing the local value", () => {
    const tree: FamilyTree = { ...newTree(), people: [{ id: "p1", firstName: "Ada", lastName: "", gender: "female", birthDate: "", deathDate: "", notes: "", photoUrl: "", photo: "data:image/png;base64,AAAA" }] };
    const online = toOnlineTree(tree, { ownerId: "owner-1" });
    expect(online.excludedDataUrlPhotoIds).toContain("p1");
    expect(online.people[0].photoUrl).toBe("");
    expect(tree.people[0].photo).toMatch(/^data:image/);
  });

  it("rejects malformed online documents and broken relationships", () => {
    const online = toOnlineTree(createJokowiDemoTree(), { ownerId: "owner-1" });
    expect(() => fromOnlineTree({ ...online, schemaVersion: 999 })).toThrow(/unsupported/i);
    expect(() => fromOnlineTree({ ...online, relationships: [{ ...online.relationships[0], fromPersonId: "missing" }] })).toThrow(/unknown person/i);
  });
});
