import { FirebaseError } from "firebase/app";
import {
  Timestamp,
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  writeBatch,
  type DocumentData,
  type Firestore,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { getFirestoreDb } from "@/lib/firebase/config";
import { fromOnlineTree } from "../domain/serialization";
import type { OnlineTree } from "../domain/onlineTypes";
import type { PublicationRepository, PublicTreeSnapshot } from "./PublicationRepository";

const MAX_ATOMIC_PUBLICATION_WRITES = 490;
const CLEANUP_BATCH_SIZE = 450;

function timestamp(value: string): Timestamp {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("Invalid tree timestamp.");
  return Timestamp.fromDate(date);
}

function timestampIso(value: unknown): string {
  if (!(value instanceof Timestamp)) throw new Error("Invalid published timestamp.");
  return value.toDate().toISOString();
}

function numberValue(value: unknown): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) throw new Error("Invalid publication revision.");
  return value as number;
}

function stringValue(value: unknown): string {
  if (typeof value !== "string" || !value) throw new Error("Invalid public snapshot.");
  return value;
}

function personDocument(person: OnlineTree["people"][number]) {
  return {
    firstName: person.firstName,
    lastName: person.lastName,
    gender: person.gender,
    birthDate: person.birthDate,
    deathDate: person.deathDate,
    notes: person.notes,
    photoUrl: person.photoUrl,
    sortOrder: person.sortOrder,
    updatedAt: serverTimestamp(),
  };
}

function relationshipDocument(relationship: OnlineTree["relationships"][number]) {
  return {
    type: relationship.type,
    fromPersonId: relationship.fromPersonId,
    toPersonId: relationship.toPersonId,
    updatedAt: serverTimestamp(),
  };
}

function nextPublishedTree(tree: OnlineTree, publicId: string): OnlineTree {
  const revision = tree.revision + 1;
  return {
    ...tree,
    visibility: "unlisted",
    publicId,
    revision,
    publishedRevision: revision,
    updatedAt: new Date().toISOString(),
  };
}

function privateTree(tree: OnlineTree): OnlineTree {
  return {
    ...tree,
    visibility: "private",
    publicId: null,
    revision: tree.revision + 1,
    publishedRevision: null,
    updatedAt: new Date().toISOString(),
  };
}

function privateMetadata(tree: OnlineTree) {
  return {
    ownerId: tree.ownerId,
    name: tree.name,
    visibility: tree.visibility,
    publicId: tree.publicId,
    revision: tree.revision,
    schemaVersion: tree.schemaVersion,
    createdAt: timestamp(tree.createdAt),
    updatedAt: serverTimestamp(),
    publishedRevision: tree.publishedRevision,
  };
}

function mapPublicError(error: unknown): Error {
  if (error instanceof FirebaseError && error.code === "permission-denied") {
    return new Error("This account cannot publish the selected family tree.");
  }
  return error instanceof Error ? error : new Error("The publication could not be updated.");
}

export class FirestorePublicationRepository implements PublicationRepository {
  constructor(private readonly db: Firestore = getFirestoreDb()) {}

  async publish(tree: OnlineTree, publicId: string, previousPublicId?: string): Promise<OnlineTree> {
    try {
      const next = nextPublishedTree(tree, publicId);
      const publicRef = doc(this.db, "publicTrees", publicId);
      const updatingCurrentSnapshot = tree.publicId === publicId;
      const [currentPeople, currentRelationships] = updatingCurrentSnapshot
        ? await Promise.all([
            getDocs(collection(publicRef, "people")),
            getDocs(collection(publicRef, "relationships")),
          ])
        : [{ size: 0, docs: [] }, { size: 0, docs: [] }];
      const writes = 2 + currentPeople.size + currentRelationships.size + next.people.length + next.relationships.length + (previousPublicId && previousPublicId !== publicId ? 1 : 0);
      if (writes > MAX_ATOMIC_PUBLICATION_WRITES) {
        throw new Error("This tree is too large for one safe public snapshot. Keep it private until chunked publishing is available.");
      }

      const batch = writeBatch(this.db);
      batch.set(doc(this.db, "trees", tree.id), privateMetadata(next));
      batch.set(publicRef, {
        sourceTreeId: tree.id,
        name: tree.name,
        enabled: true,
        schemaVersion: tree.schemaVersion,
        publishedRevision: next.revision,
        publishedAt: serverTimestamp(),
      });

      const personIds = new Set(next.people.map(person => person.id));
      const relationshipIds = new Set(next.relationships.map(relationship => relationship.id));
      currentPeople.docs.forEach(item => { if (!personIds.has(item.id)) batch.delete(item.ref); });
      currentRelationships.docs.forEach(item => { if (!relationshipIds.has(item.id)) batch.delete(item.ref); });
      next.people.forEach(person => batch.set(doc(publicRef, "people", person.id), personDocument(person)));
      next.relationships.forEach(relationship => batch.set(doc(publicRef, "relationships", relationship.id), relationshipDocument(relationship)));

      if (previousPublicId && previousPublicId !== publicId) {
        batch.update(doc(this.db, "publicTrees", previousPublicId), {
          enabled: false,
          publishedAt: serverTimestamp(),
        });
      }
      await batch.commit();
      return next;
    } catch (error) {
      throw mapPublicError(error);
    }
  }

  async disable(tree: OnlineTree, publicId: string): Promise<OnlineTree> {
    try {
      const next = privateTree(tree);
      const batch = writeBatch(this.db);
      // This commit revokes the bearer link before any child cleanup begins.
      batch.update(doc(this.db, "publicTrees", publicId), {
        enabled: false,
        publishedAt: serverTimestamp(),
      });
      batch.set(doc(this.db, "trees", tree.id), privateMetadata(next));
      await batch.commit();
      return next;
    } catch (error) {
      throw mapPublicError(error);
    }
  }

  async cleanupDisabled(publicId: string): Promise<void> {
    const publicRef = doc(this.db, "publicTrees", publicId);
    const snapshots = await Promise.all([
      getDocs(collection(publicRef, "people")),
      getDocs(collection(publicRef, "relationships")),
    ]);
    const references = snapshots.flatMap(snapshot => snapshot.docs.map(item => item.ref));
    for (let offset = 0; offset < references.length; offset += CLEANUP_BATCH_SIZE) {
      const batch = writeBatch(this.db);
      references.slice(offset, offset + CLEANUP_BATCH_SIZE).forEach(reference => batch.delete(reference));
      await batch.commit();
    }
    const batch = writeBatch(this.db);
    batch.delete(publicRef);
    await batch.commit();
  }

  async loadPublic(publicId: string): Promise<PublicTreeSnapshot | null> {
    try {
      // Intentionally no private tree lookup and no top-level public query.
      const publicRef = doc(this.db, "publicTrees", publicId);
      const metadataSnapshot = await getDoc(publicRef);
      if (!metadataSnapshot.exists() || metadataSnapshot.data().enabled !== true) return null;
      const [peopleSnapshot, relationshipsSnapshot] = await Promise.all([
        getDocs(collection(publicRef, "people")),
        getDocs(collection(publicRef, "relationships")),
      ]);
      return deserializePublic(publicId, metadataSnapshot.data(), peopleSnapshot.docs, relationshipsSnapshot.docs);
    } catch {
      // Unknown, disabled, malformed, offline, and denied links are deliberately indistinguishable.
      return null;
    }
  }
}

function deserializePublic(
  publicId: string,
  data: DocumentData,
  peopleDocs: QueryDocumentSnapshot[],
  relationshipDocs: QueryDocumentSnapshot[],
): PublicTreeSnapshot {
  const publishedAt = timestampIso(data.publishedAt);
  const publishedRevision = numberValue(data.publishedRevision);
  const name = stringValue(data.name);
  const schemaVersion = numberValue(data.schemaVersion);
  const tree = fromOnlineTree({
    id: publicId,
    ownerId: "public-snapshot",
    name,
    visibility: "unlisted",
    publicId,
    revision: publishedRevision,
    schemaVersion,
    createdAt: publishedAt,
    updatedAt: publishedAt,
    publishedRevision,
    people: peopleDocs.map(item => ({
      id: item.id,
      ...item.data(),
      updatedAt: timestampIso(item.data().updatedAt),
    })),
    relationships: relationshipDocs.map(item => ({
      id: item.id,
      ...item.data(),
      updatedAt: timestampIso(item.data().updatedAt),
    })),
  });
  return { publicId, name, schemaVersion, publishedRevision, publishedAt, tree };
}
