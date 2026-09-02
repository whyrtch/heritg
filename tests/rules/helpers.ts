import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  RulesTestContext,
  RulesTestEnvironment,
  initializeTestEnvironment,
} from "@firebase/rules-unit-testing";
import { Timestamp, doc, setDoc } from "firebase/firestore";

export const PROJECT_ID = "heritg-rules-test";
export const OWNER_UID = "owner-uid";
export const ATTACKER_UID = "attacker-uid";
export const TREE_ID = "tree-one";
export const PUBLIC_ID = "public_identifier_1234567890";

export async function createRulesEnvironment(
  projectId = PROJECT_ID,
): Promise<RulesTestEnvironment> {
  return initializeTestEnvironment({
    projectId,
    firestore: {
      host: "127.0.0.1",
      port: 8080,
      rules: await readFile(path.resolve("firestore.rules"), "utf8"),
    },
  });
}

export function ownerContext(env: RulesTestEnvironment): RulesTestContext {
  return env.authenticatedContext(OWNER_UID, { email: "owner@example.com" });
}

export function attackerContext(env: RulesTestEnvironment): RulesTestContext {
  return env.authenticatedContext(ATTACKER_UID, { email: "attacker@example.com" });
}

export const now = () => Timestamp.fromMillis(Date.now());

export function validTree(overrides: Record<string, unknown> = {}) {
  const timestamp = now();
  return {
    ownerId: OWNER_UID,
    name: "Keluarga Uji",
    visibility: "private",
    publicId: null,
    revision: 0,
    schemaVersion: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
    publishedRevision: null,
    ...overrides,
  };
}

export function validPerson(overrides: Record<string, unknown> = {}) {
  return {
    firstName: "Budi",
    lastName: "Uji",
    gender: "male",
    birthDate: "1980-01-02",
    deathDate: "",
    notes: "",
    photoUrl: "https://example.com/photo.jpg",
    sortOrder: 0,
    updatedAt: now(),
    ...overrides,
  };
}

export function validRelationship(overrides: Record<string, unknown> = {}) {
  return {
    type: "parent-child",
    fromPersonId: "person-one",
    toPersonId: "person-two",
    updatedAt: now(),
    ...overrides,
  };
}

export async function seedTree(
  env: RulesTestEnvironment,
  options: { publicId?: string | null; enabled?: boolean } = {},
) {
  const publicId = options.publicId === undefined ? PUBLIC_ID : options.publicId;
  const enabled = options.enabled ?? true;
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(
      doc(db, `trees/${TREE_ID}`),
      validTree(
        publicId
          ? {
              visibility: "unlisted",
              publicId,
              revision: 2,
              publishedRevision: 2,
            }
          : {},
      ),
    );
    await setDoc(doc(db, `trees/${TREE_ID}/people/person-one`), validPerson());
    await setDoc(
      doc(db, `trees/${TREE_ID}/people/person-two`),
      validPerson({ firstName: "Ani", sortOrder: 1 }),
    );

    if (publicId) {
      await setDoc(doc(db, `publicTrees/${publicId}`), {
        sourceTreeId: TREE_ID,
        name: "Keluarga Uji",
        enabled,
        schemaVersion: 1,
        publishedRevision: 2,
        publishedAt: now(),
      });
      await setDoc(
        doc(db, `publicTrees/${publicId}/people/person-one`),
        validPerson(),
      );
      await setDoc(
        doc(db, `publicTrees/${publicId}/people/person-two`),
        validPerson({ firstName: "Ani", sortOrder: 1 }),
      );
      await setDoc(
        doc(db, `publicTrees/${publicId}/relationships/relationship-one`),
        validRelationship(),
      );
    }
  });
}
