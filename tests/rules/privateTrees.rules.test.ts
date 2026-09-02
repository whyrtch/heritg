// @vitest-environment node
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { assertFails, assertSucceeds, RulesTestEnvironment } from "@firebase/rules-unit-testing";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import {
  ATTACKER_UID,
  OWNER_UID,
  TREE_ID,
  attackerContext,
  createRulesEnvironment,
  ownerContext,
  seedTree,
} from "./helpers";

describe("private tree rules", () => {
  let env: RulesTestEnvironment;
  beforeAll(async () => { env = await createRulesEnvironment("heritg-private-rules-test"); });
  afterEach(async () => { await env.clearFirestore(); });
  afterAll(async () => { await env.cleanup(); });

  it("allows an owner to create a valid private tree", async () => {
    const db = ownerContext(env).firestore();
    await assertSucceeds(setDoc(doc(db, "trees/new-tree"), {
      ownerId: OWNER_UID,
      name: "Pohon Baru",
      visibility: "private",
      publicId: null,
      revision: 0,
      schemaVersion: 1,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      publishedRevision: null,
    }));
  });

  it("allows only the owner to read an owned tree", async () => {
    await seedTree(env, { publicId: null });
    await assertSucceeds(getDoc(doc(ownerContext(env).firestore(), `trees/${TREE_ID}`)));
    await assertFails(getDoc(doc(attackerContext(env).firestore(), `trees/${TREE_ID}`)));
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), `trees/${TREE_ID}`)));
  });

  it("supports only an owner-constrained tree listing query", async () => {
    await seedTree(env, { publicId: null });
    const db = ownerContext(env).firestore();
    await assertSucceeds(getDocs(query(
      collection(db, "trees"),
      where("ownerId", "==", OWNER_UID),
      orderBy("updatedAt", "desc"),
    )));
    await assertFails(getDocs(collection(db, "trees")));
  });

  it("does not activate future member roles", async () => {
    await seedTree(env, { publicId: null });
    await env.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), `trees/${TREE_ID}/members/${ATTACKER_UID}`), {
        role: "editor",
        invitedAt: null,
        acceptedAt: null,
      });
    });
    const attackerDb = attackerContext(env).firestore();
    await assertFails(getDoc(doc(attackerDb, `trees/${TREE_ID}`)));
    await assertFails(setDoc(doc(attackerDb, `trees/${TREE_ID}/people/injected`), {
      firstName: "Evil",
      lastName: "Editor",
      gender: "unspecified",
      birthDate: "",
      deathDate: "",
      notes: "",
      photoUrl: "",
      sortOrder: 2,
      updatedAt: serverTimestamp(),
    }));
  });

  it("prevents ownership changes and non-incrementing revisions", async () => {
    await seedTree(env, { publicId: null });
    const ref = doc(ownerContext(env).firestore(), `trees/${TREE_ID}`);
    await assertFails(updateDoc(ref, { ownerId: ATTACKER_UID, revision: 1, updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(ref, { name: "No revision", updatedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(ref, { name: "Valid update", revision: 1, updatedAt: serverTimestamp() }));
  });
});
