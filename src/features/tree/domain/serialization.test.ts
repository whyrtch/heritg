import { describe, expect, it } from "vitest";
import { createJokowiDemoTree } from "../demoData";
import { newTree, type FamilyTree } from "../model";
import { fromOnlineTree, toOnlineTree } from "./serialization";

const omit = <T extends object>(value: T, ...keys: string[]) => Object.fromEntries(Object.entries(value).filter(([key]) => !keys.includes(key)));

describe("online tree serialization", () => {
  it("maps stable IDs and online metadata exactly", () => {
    const local = createJokowiDemoTree();
    local.people[0].photoUrl = "https://images.example.test/lamidi.jpg";
    const online = toOnlineTree(local, { ownerId: "owner-1", revision: 4, visibility: "unlisted", publicId: "public-1" });

    expect(online).toMatchObject({ id: local.id, ownerId: "owner-1", revision: 4, schemaVersion: 2, visibility: "unlisted", publicId: "public-1" });
    expect(online.people[0]).toMatchObject({ id: "lamidi", photoUrl: "https://images.example.test/lamidi.jpg", sortOrder: 0 });
    expect(online.relationships[0]).toMatchObject({ id: "partner-lamidi-painem", fromPersonId: "lamidi", toPersonId: "painem" });
    expect(fromOnlineTree(online)).toMatchObject({
      id: local.id,
      name: local.name,
      people: local.people.map(person => ({
        id: person.id,
        name: person.name,
        gender: person.gender,
        birthDate: person.birthDate,
        deathDate: person.deathDate,
        birthOrder: person.birthOrder,
        residence: person.residence,
        notes: person.notes,
        photoUrl: person.photoUrl,
      })),
      relationships: local.relationships,
      updatedAt: local.updatedAt,
    });
  });

  it("never sends embedded or server photos inside the tree, and keeps the local value", () => {
    const tree: FamilyTree = { ...newTree(), people: [{ id: "p1", name: "Ada", gender: "female", birthDate: "", deathDate: "", birthOrder: null, residence: "", notes: "", photoUrl: "", photo: "data:image/png;base64,AAAA" }] };
    const online = toOnlineTree(tree, { ownerId: "owner-1" });
    // Embedded images upload through the photo endpoint (sync/photoQueue.ts), so nothing is excluded.
    expect(online.excludedDataUrlPhotoIds).toEqual([]);
    expect(online.people[0].photoUrl).toBe("");
    expect(tree.people[0].photo).toMatch(/^data:image/);
    const server = toOnlineTree({ ...tree, people: [{ ...tree.people[0], photo: "/api/trees/t/people/p1/photo?v=0123456789abcdef" }] }, { ownerId: "owner-1" });
    expect(server.people[0].photoUrl).toBe("");
  });

  it("turns the server photo version into a cacheable photo path", () => {
    const online = toOnlineTree(createJokowiDemoTree(), { ownerId: "owner-1" });
    const withPhoto = { ...online, people: online.people.map((person, index) => index === 0 ? { ...person, photoVersion: "0123456789abcdef" } : person) };
    expect(fromOnlineTree(withPhoto).people[0].photo).toBe(`/api/trees/${online.id}/people/${online.people[0].id}/photo?v=0123456789abcdef`);
    expect(fromOnlineTree(withPhoto, { photoPath: (id, v) => `/x/${id}/${v}` }).people[0].photo).toBe(`/x/${online.people[0].id}/0123456789abcdef`);
    expect(fromOnlineTree({ ...withPhoto, people: withPhoto.people.map(person => ({ ...person, photoVersion: "../../evil" })) }).people[0].photo).toBe("");
  });

  it("reads schema v1 documents and upgrades them to v2", () => {
    const online = toOnlineTree(createJokowiDemoTree(), { ownerId: "owner-1" });
    const v1 = {
      ...online,
      schemaVersion: 1,
      people: online.people.map(({ name, ...person }, index) => ({ ...omit(person, "birthOrder", "residence"), firstName: name, lastName: index === 0 ? "Senior" : "", gender: index === 1 ? "nonbinary" : person.gender })),
      relationships: online.relationships.map(relationship => omit(relationship, "kind", "status", "marriedOn")),
    } as unknown as typeof online;
    const tree = fromOnlineTree(v1);
    expect(tree.people[0]).toMatchObject({ name: `${online.people[0].name} Senior`, birthOrder: null, residence: "" });
    expect(tree.people[1].gender).toBe("unspecified");
    expect(tree.relationships.find(r => r.type === "partner")).toMatchObject({ kind: null, status: "married", marriedOn: "" });
    expect(tree.relationships.find(r => r.type === "parent-child")).toMatchObject({ kind: "biological", status: null, marriedOn: "" });
    expect(toOnlineTree(tree, { ownerId: "owner-1" }).schemaVersion).toBe(2);
  });

  it("rejects malformed online documents and broken relationships", () => {
    const online = toOnlineTree(createJokowiDemoTree(), { ownerId: "owner-1" });
    expect(() => fromOnlineTree({ ...online, schemaVersion: 999 })).toThrow(/unsupported/i);
    expect(() => fromOnlineTree({ ...online, relationships: [{ ...online.relationships[0], fromPersonId: "missing" }] })).toThrow(/unknown person/i);
  });
});
