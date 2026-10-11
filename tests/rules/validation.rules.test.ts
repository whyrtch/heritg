// @vitest-environment node
import { afterAll, afterEach, beforeAll, describe, it } from "vitest";
import { assertFails, assertSucceeds, RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import {
  ATTACKER_UID,
  OWNER_UID,
  TREE_ID,
  attackerContext,
  createRulesEnvironment,
  ownerContext,
  seedTree,
  validPerson,
  validRelationship,
} from "./helpers";

describe("strict schema validation", () => {
  let env: RulesTestEnvironment;
  beforeAll(async () => { env = await createRulesEnvironment("heritg-validation-rules-test"); });
  afterEach(async () => { await env.clearFirestore(); });
  afterAll(async () => { await env.cleanup(); });

  it("rejects schema pollution, oversized text, and insecure photo URLs", async () => {
    await seedTree(env, { publicId: null });
    const db = ownerContext(env).firestore();
    const basePath = `trees/${TREE_ID}/people/`;
    await assertFails(setDoc(doc(db, `${basePath}extra`), validPerson({ extraData: "pollution", updatedAt: serverTimestamp() })));
    await assertFails(setDoc(doc(db, `${basePath}huge`), validPerson({ notes: "x".repeat(10001), updatedAt: serverTimestamp() })));
    await assertFails(setDoc(doc(db, `${basePath}photo`), validPerson({ photoUrl: "http://example.com/a.jpg", updatedAt: serverTimestamp() })));
    await assertSucceeds(setDoc(doc(db, `${basePath}valid`), validPerson({ photoUrl: "", updatedAt: serverTimestamp() })));
  });

  it("applies the full person validator on update", async () => {
    await seedTree(env, { publicId: null });
    const ref = doc(ownerContext(env).firestore(), `trees/${TREE_ID}/people/person-one`);
    await assertFails(updateDoc(ref, { name: "x".repeat(121), updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(ref, { gender: 7, updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(ref, { unexpected: true, updatedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(ref, { name: "Nama Baru", updatedAt: serverTimestamp() }));
  });

  it("accepts only schema v2 person fields", async () => {
    await seedTree(env, { publicId: null });
    const db = ownerContext(env).firestore();
    const basePath = `trees/${TREE_ID}/people/`;
    await assertFails(setDoc(doc(db, `${basePath}legacy`), { firstName: "Budi", lastName: "Uji", gender: "male", birthDate: "", deathDate: "", notes: "", photoUrl: "", sortOrder: 0, updatedAt: serverTimestamp() }));
    await assertFails(setDoc(doc(db, `${basePath}nonbinary`), validPerson({ gender: "nonbinary", updatedAt: serverTimestamp() })));
    await assertFails(setDoc(doc(db, `${basePath}order0`), validPerson({ birthOrder: 0, updatedAt: serverTimestamp() })));
    await assertFails(setDoc(doc(db, `${basePath}order100`), validPerson({ birthOrder: 100, updatedAt: serverTimestamp() })));
    await assertFails(setDoc(doc(db, `${basePath}orderFloat`), validPerson({ birthOrder: 1.5, updatedAt: serverTimestamp() })));
    await assertFails(setDoc(doc(db, `${basePath}residence`), validPerson({ residence: "x".repeat(121), updatedAt: serverTimestamp() })));
    await assertFails(setDoc(doc(db, `${basePath}noName`), validPerson({ name: "", updatedAt: serverTimestamp() })));
    await assertSucceeds(setDoc(doc(db, `${basePath}second`), validPerson({ birthOrder: 2, residence: "Solo", updatedAt: serverTimestamp() })));
  });

  it("validates relationship kind, status and marriage date by type", async () => {
    await seedTree(env, { publicId: null });
    const db = ownerContext(env).firestore();
    const rel = (id: string) => doc(db, `trees/${TREE_ID}/relationships/${id}`);
    const at = { updatedAt: serverTimestamp() };
    await assertFails(setDoc(rel("legacy"), { type: "parent-child", fromPersonId: "person-one", toPersonId: "person-two", ...at }));
    await assertFails(setDoc(rel("badKind"), validRelationship({ kind: "cousin", ...at })));
    await assertFails(setDoc(rel("childWithStatus"), validRelationship({ status: "married", ...at })));
    await assertFails(setDoc(rel("childMarried"), validRelationship({ marriedOn: "2000-01-01", ...at })));
    await assertFails(setDoc(rel("partnerKind"), validRelationship({ type: "partner", kind: "biological", status: "married", ...at })));
    await assertFails(setDoc(rel("partnerBadStatus"), validRelationship({ type: "partner", kind: null, status: "engaged", ...at })));
    await assertFails(setDoc(rel("partnerBadDate"), validRelationship({ type: "partner", kind: null, status: "married", marriedOn: "01-01-2000", ...at })));
    await assertSucceeds(setDoc(rel("step"), validRelationship({ kind: "step", ...at })));
    await assertSucceeds(setDoc(rel("ex"), validRelationship({ type: "partner", kind: null, status: "ex", marriedOn: "1990-05-17", ...at })));
  });

  it("requires relationship endpoints in the same tree", async () => {
    await seedTree(env, { publicId: null });
    const db = ownerContext(env).firestore();
    await assertFails(setDoc(doc(db, `trees/${TREE_ID}/relationships/broken`), validRelationship({
      toPersonId: "missing-person",
      updatedAt: serverTimestamp(),
    })));
    await assertSucceeds(setDoc(doc(db, `trees/${TREE_ID}/relationships/valid`), validRelationship({
      updatedAt: serverTimestamp(),
    })));
  });

  it("keeps user PII self-only and prevents email replacement", async () => {
    const ownerDb = ownerContext(env).firestore();
    const userRef = doc(ownerDb, `users/${OWNER_UID}`);
    await assertSucceeds(setDoc(userRef, {
      email: "owner@example.com",
      displayName: "Owner",
      createdAt: serverTimestamp(),
    }));
    await assertFails(updateDoc(userRef, { email: "other@example.com" }));
    await assertFails(setDoc(doc(attackerContext(env).firestore(), `users/${OWNER_UID}`), {
      email: "attacker@example.com",
      displayName: "Attacker",
      createdAt: serverTimestamp(),
    }));
  });

  it("does not let an attacker grant themselves a member role", async () => {
    await seedTree(env, { publicId: null });
    await assertFails(setDoc(
      doc(attackerContext(env).firestore(), `trees/${TREE_ID}/members/${ATTACKER_UID}`),
      { role: "owner", invitedAt: null, acceptedAt: null },
    ));
  });
});
