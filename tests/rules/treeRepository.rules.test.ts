import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { RulesTestEnvironment } from "@firebase/rules-unit-testing";
import type { Firestore } from "firebase/firestore";
import type { OnlineTree } from "@/features/tree/domain/onlineTypes";
import { FirestorePublicationRepository } from "@/features/tree/publishing/FirestorePublicationRepository";
import { FirestoreTreeRepository } from "@/features/tree/repository/FirestoreTreeRepository";
import { TreeRepositoryError } from "@/features/tree/repository/TreeRepository";
import { ATTACKER_UID, OWNER_UID, attackerContext, createRulesEnvironment, ownerContext } from "./helpers";

let env: RulesTestEnvironment;

const newTree = (id: string): OnlineTree => ({
  id, ownerId: OWNER_UID, name: "Family Tree 2", visibility: "private", publicId: null, revision: 0, schemaVersion: 1,
  createdAt: "2026-10-11T00:00:00.000Z", updatedAt: "2026-10-11T00:00:00.000Z", publishedRevision: null,
  people: [{ id: "cimi", firstName: "Cimi", lastName: "Ningsih", gender: "female", birthDate: "2018-09-10", deathDate: "", notes: "", photoUrl: "", sortOrder: 0, updatedAt: "2026-10-11T00:00:00.000Z" }],
  relationships: [],
});

describe("FirestoreTreeRepository against the Rules", () => {
  beforeAll(async () => { env = await createRulesEnvironment("heritg-repository-test"); });
  beforeEach(async () => { await env.clearFirestore(); });
  afterAll(async () => { await env.cleanup(); });

  it("lets the owner create a brand-new tree", async () => {
    const repository = new FirestoreTreeRepository(ownerContext(env).firestore() as unknown as Firestore);
    const created = await repository.create(newTree("fresh-tree"));
    expect(created.id).toBe("fresh-tree");
    expect(created.people.map(person => person.firstName)).toEqual(["Cimi"]);
  });

  it("saves an edit that adds a child, then reloads it from Firestore", async () => {
    const repository = new FirestoreTreeRepository(ownerContext(env).firestore() as unknown as Firestore);
    const created = await repository.create(newTree("edited-tree"));
    const child = { ...created.people[0], id: "thomas", firstName: "Thomas", lastName: "The cat", birthDate: "" };
    const edited: OnlineTree = { ...created, people: [...created.people, child], relationships: [{ id: "cimi-thomas", type: "parent-child", fromPersonId: "cimi", toPersonId: "thomas", updatedAt: created.updatedAt }] };
    const saved = await repository.save(edited, created.revision);
    expect(saved.revision).toBe(created.revision + 1);
    const reloaded = await repository.load("edited-tree");
    expect(reloaded.people.map(person => person.firstName).sort()).toEqual(["Cimi", "Thomas"]);
    expect(reloaded.relationships).toHaveLength(1);
    expect(reloaded.createdAt).toBe(created.createdAt);
  });

  it("publishes a created tree and keeps its private metadata valid", async () => {
    const db = ownerContext(env).firestore() as unknown as Firestore;
    const created = await new FirestoreTreeRepository(db).create(newTree("shared-tree"));
    const published = await new FirestorePublicationRepository(db).publish(created, "public_identifier_abcdefghijklmnop");
    expect(published.visibility).toBe("unlisted");
    expect((await new FirestoreTreeRepository(db).load("shared-tree")).publicId).toBe("public_identifier_abcdefghijklmnop");
  });

  it("reports an existing tree id as a conflict so interrupted migrations can resume", async () => {
    const repository = new FirestoreTreeRepository(ownerContext(env).firestore() as unknown as Firestore);
    await repository.create(newTree("existing-tree"));
    await expect(repository.create(newTree("existing-tree"))).rejects.toMatchObject({ code: "conflict" } satisfies Partial<TreeRepositoryError>);
  });
});

describe("FirestoreTreeRepository edge cases against the Rules", () => {
  beforeAll(async () => { env = await createRulesEnvironment("heritg-repository-edge-test"); });
  beforeEach(async () => { await env.clearFirestore(); });
  afterAll(async () => { await env.cleanup(); });

  it("rejects creating over another owner's tree id as permission-denied, not conflict", async () => {
    await new FirestoreTreeRepository(ownerContext(env).firestore() as unknown as Firestore).create(newTree("owners-tree"));
    const attacker = new FirestoreTreeRepository(attackerContext(env).firestore() as unknown as Firestore);
    await expect(attacker.create({ ...newTree("owners-tree"), ownerId: ATTACKER_UID })).rejects.toMatchObject({ code: "permission-denied" } satisfies Partial<TreeRepositoryError>);
  });

  it("creates a large tree through the chunked operations path", async () => {
    const repository = new FirestoreTreeRepository(ownerContext(env).firestore() as unknown as Firestore);
    const base = newTree("large-tree");
    const people = Array.from({ length: 460 }, (_, index) => ({ ...base.people[0], id: `person-${index}`, firstName: `Person ${index}`, sortOrder: index }));
    const created = await repository.create({ ...base, people });
    expect(created.people).toHaveLength(460);
  }, 60_000);
});
