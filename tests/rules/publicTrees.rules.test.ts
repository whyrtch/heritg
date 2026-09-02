// @vitest-environment node
import { afterAll, afterEach, beforeAll, describe, it } from "vitest";
import { assertFails, assertSucceeds, RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { collection, doc, getDoc, getDocs, serverTimestamp, setDoc } from "firebase/firestore";
import {
  PUBLIC_ID,
  TREE_ID,
  createRulesEnvironment,
  ownerContext,
  seedTree,
  validPerson,
} from "./helpers";

describe("unlisted public snapshot rules", () => {
  let env: RulesTestEnvironment;
  beforeAll(async () => { env = await createRulesEnvironment("heritg-public-rules-test"); });
  afterEach(async () => { await env.clearFirestore(); });
  afterAll(async () => { await env.cleanup(); });

  it("allows exact enabled snapshot reads and known-parent child queries", async () => {
    await seedTree(env);
    const anonymousDb = env.unauthenticatedContext().firestore();
    await assertSucceeds(getDoc(doc(anonymousDb, `publicTrees/${PUBLIC_ID}`)));
    await assertSucceeds(getDocs(collection(anonymousDb, `publicTrees/${PUBLIC_ID}/people`)));
    await assertSucceeds(getDocs(collection(anonymousDb, `publicTrees/${PUBLIC_ID}/relationships`)));
  });

  it("denies top-level enumeration and all anonymous writes", async () => {
    await seedTree(env);
    const anonymousDb = env.unauthenticatedContext().firestore();
    await assertFails(getDocs(collection(anonymousDb, "publicTrees")));
    await assertFails(setDoc(doc(anonymousDb, `publicTrees/${PUBLIC_ID}/people/injected`), validPerson({
      updatedAt: serverTimestamp(),
    })));
  });

  it("denies disabled and orphaned snapshot reads", async () => {
    await seedTree(env, { enabled: false });
    const anonymousDb = env.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(anonymousDb, `publicTrees/${PUBLIC_ID}`)));
    await assertFails(getDocs(collection(anonymousDb, `publicTrees/${PUBLIC_ID}/people`)));
    await assertFails(getDocs(collection(anonymousDb, "publicTrees/orphan_public_identifier_123/people")));
  });

  it("allows only the source-tree owner to manage a public snapshot", async () => {
    await seedTree(env, { publicId: null });
    const ownerDb = ownerContext(env).firestore();
    const publicId = "new_public_identifier_123456";

    // Publishing is an atomic batch in the application. This isolated rule
    // check first seeds the corresponding unlisted source state.
    await env.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), `trees/${TREE_ID}`), {
        ownerId: "owner-uid",
        name: "Keluarga Uji",
        visibility: "unlisted",
        publicId,
        revision: 1,
        schemaVersion: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        publishedRevision: 1,
      });
    });

    await assertSucceeds(setDoc(doc(ownerDb, `publicTrees/${publicId}`), {
      sourceTreeId: TREE_ID,
      name: "Keluarga Uji",
      enabled: true,
      schemaVersion: 1,
      publishedRevision: 1,
      publishedAt: serverTimestamp(),
    }));
  });
});
