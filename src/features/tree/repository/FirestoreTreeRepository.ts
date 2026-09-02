import { FirebaseError } from "firebase/app";
import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  setDoc,
  where,
  writeBatch,
  type DocumentData,
  type Firestore,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { getFirestoreDb } from "@/lib/firebase/config";
import { ONLINE_TREE_SCHEMA_VERSION, type OnlineTree } from "../domain/onlineTypes";
import { nextRevision } from "../domain/revision";
import { fromOnlineTree, toOnlineTree } from "../domain/serialization";
import { TreeRepositoryError, type TreeRepository } from "./TreeRepository";

const MAX_BATCH_OPERATIONS = 450;

function timestamp(value: string): Timestamp {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new TreeRepositoryError("invalid-data", "A tree timestamp is invalid.");
  return Timestamp.fromDate(date);
}

function iso(value: unknown, field: string): string {
  if (!(value instanceof Timestamp)) throw new TreeRepositoryError("invalid-data", `${field} is not a Firestore timestamp.`);
  return value.toDate().toISOString();
}

function nullableString(value: unknown, field: string): string | null {
  if (value === null) return null;
  if (typeof value !== "string") throw new TreeRepositoryError("invalid-data", `${field} is invalid.`);
  return value;
}

function integer(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) throw new TreeRepositoryError("invalid-data", `${field} is invalid.`);
  return value as number;
}

function metadata(tree: OnlineTree) {
  return {
    ownerId: tree.ownerId,
    name: tree.name,
    visibility: tree.visibility,
    publicId: tree.publicId,
    revision: tree.revision,
    schemaVersion: tree.schemaVersion,
    createdAt: timestamp(tree.createdAt),
    updatedAt: timestamp(tree.updatedAt),
    publishedRevision: tree.publishedRevision,
  };
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
    updatedAt: timestamp(person.updatedAt),
  };
}

function relationshipDocument(relationship: OnlineTree["relationships"][number]) {
  return {
    type: relationship.type,
    fromPersonId: relationship.fromPersonId,
    toPersonId: relationship.toPersonId,
    updatedAt: timestamp(relationship.updatedAt),
  };
}

function mapError(error: unknown): TreeRepositoryError {
  if (error instanceof TreeRepositoryError) return error;
  if (error instanceof FirebaseError) {
    if (error.code === "permission-denied") return new TreeRepositoryError("permission-denied", "You do not have access to this family tree.", { cause: error });
    if (error.code === "unavailable" || error.code === "deadline-exceeded" || error.code === "network-request-failed") return new TreeRepositoryError("offline", "The family tree service is unavailable.", { cause: error });
    if (error.code === "not-found") return new TreeRepositoryError("not-found", "Family tree was not found.", { cause: error });
  }
  return new TreeRepositoryError("invalid-data", "The family tree operation could not be completed.", { cause: error });
}

type WriteAction = (batch: ReturnType<typeof writeBatch>) => void;

export class FirestoreTreeRepository implements TreeRepository {
  constructor(private readonly db: Firestore = getFirestoreDb()) {}

  async listOwned(uid: string): Promise<OnlineTree[]> {
    try {
      const snapshot = await getDocs(query(collection(this.db, "trees"), where("ownerId", "==", uid)));
      const trees = await Promise.all(snapshot.docs.map(item => this.load(item.id)));
      return trees.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    } catch (error) {
      throw mapError(error);
    }
  }

  async load(treeId: string): Promise<OnlineTree> {
    try {
      const treeSnapshot = await getDoc(doc(this.db, "trees", treeId));
      if (!treeSnapshot.exists()) throw new TreeRepositoryError("not-found", "Family tree was not found.");
      const [peopleSnapshot, relationshipsSnapshot] = await Promise.all([
        getDocs(collection(this.db, "trees", treeId, "people")),
        getDocs(collection(this.db, "trees", treeId, "relationships")),
      ]);
      return this.deserialize(treeSnapshot.id, treeSnapshot.data(), peopleSnapshot.docs, relationshipsSnapshot.docs);
    } catch (error) {
      throw mapError(error);
    }
  }

  async create(tree: OnlineTree): Promise<OnlineTree> {
    try {
      if (!tree.ownerId) throw new TreeRepositoryError("invalid-data", "A family tree owner is required.");
      const existing = await getDoc(doc(this.db, "trees", tree.id));
      if (existing.exists()) throw new TreeRepositoryError("conflict", "A family tree with this ID already exists.");
      const initialBatch = writeBatch(this.db);
      initialBatch.set(doc(this.db, "trees", tree.id), metadata(tree));
      initialBatch.set(doc(this.db, "trees", tree.id, "members", tree.ownerId), {
        role: "owner", invitedAt: null, acceptedAt: timestamp(tree.createdAt),
      });
      await initialBatch.commit();
      await this.writeChunks(tree.id, this.childWriteActions(tree));
      return this.load(tree.id);
    } catch (error) {
      throw mapError(error);
    }
  }

  async save(tree: OnlineTree, expectedRevision: number): Promise<OnlineTree> {
    try {
      const saved = { ...tree, revision: nextRevision(expectedRevision) };
      const treeRef = doc(this.db, "trees", tree.id);
      await runTransaction(this.db, async transaction => {
        const current = await transaction.get(treeRef);
        if (!current.exists()) throw new TreeRepositoryError("not-found", "Family tree was not found.");
        if (current.data().ownerId !== tree.ownerId) throw new TreeRepositoryError("permission-denied", "The family tree owner cannot be changed.");
        if (current.data().revision !== expectedRevision) throw new TreeRepositoryError("conflict", "The family tree was updated elsewhere.");
        transaction.set(treeRef, metadata(saved));
      });
      await this.replaceChildren(saved);
      return saved;
    } catch (error) {
      throw mapError(error);
    }
  }

  async delete(treeId: string): Promise<void> {
    try {
      const treeRef = doc(this.db, "trees", treeId);
      if (!(await getDoc(treeRef)).exists()) throw new TreeRepositoryError("not-found", "Family tree was not found.");
      const paths = ["people", "relationships", "members", "operations"];
      const snapshots = await Promise.all(paths.map(path => getDocs(collection(this.db, "trees", treeId, path))));
      const actions: WriteAction[] = snapshots.flatMap(snapshot => snapshot.docs.map(item => batch => batch.delete(item.ref)));
      await this.writeActions(actions);
      await deleteDoc(treeRef);
    } catch (error) {
      throw mapError(error);
    }
  }

  private deserialize(treeId: string, data: DocumentData, peopleDocs: QueryDocumentSnapshot[], relationshipDocs: QueryDocumentSnapshot[]): OnlineTree {
    const createdAt = iso(data.createdAt, "createdAt");
    const updatedAt = iso(data.updatedAt, "updatedAt");
    const revision = integer(data.revision, "revision");
    const publishedRevision = data.publishedRevision === null ? null : integer(data.publishedRevision, "publishedRevision");
    const raw = {
      id: treeId,
      ownerId: data.ownerId,
      name: data.name,
      visibility: data.visibility,
      publicId: nullableString(data.publicId, "publicId"),
      revision,
      schemaVersion: data.schemaVersion,
      createdAt,
      updatedAt,
      publishedRevision,
      people: peopleDocs.map(item => ({ ...item.data(), id: item.id, updatedAt: iso(item.data().updatedAt, "person.updatedAt") })),
      relationships: relationshipDocs.map(item => ({ ...item.data(), id: item.id, updatedAt: iso(item.data().updatedAt, "relationship.updatedAt") })),
    };
    const local = fromOnlineTree(raw);
    const normalized = toOnlineTree(local, {
      ownerId: typeof data.ownerId === "string" ? data.ownerId : "",
      visibility: data.visibility === "unlisted" ? "unlisted" : "private",
      publicId: raw.publicId,
      revision,
      createdAt,
      publishedRevision,
    });
    const { excludedDataUrlPhotoIds: _excluded, ...tree } = normalized;
    void _excluded;
    return tree;
  }

  private childWriteActions(tree: OnlineTree): WriteAction[] {
    return [
      ...tree.people.map(person => (batch: ReturnType<typeof writeBatch>) => batch.set(doc(this.db, "trees", tree.id, "people", person.id), personDocument(person))),
      ...tree.relationships.map(relationship => (batch: ReturnType<typeof writeBatch>) => batch.set(doc(this.db, "trees", tree.id, "relationships", relationship.id), relationshipDocument(relationship))),
    ];
  }

  private async replaceChildren(tree: OnlineTree): Promise<void> {
    const [currentPeople, currentRelationships] = await Promise.all([
      getDocs(collection(this.db, "trees", tree.id, "people")),
      getDocs(collection(this.db, "trees", tree.id, "relationships")),
    ]);
    const peopleIds = new Set(tree.people.map(person => person.id));
    const relationshipIds = new Set(tree.relationships.map(relationship => relationship.id));
    const actions = this.childWriteActions(tree);
    for (const item of currentPeople.docs) if (!peopleIds.has(item.id)) actions.push(batch => batch.delete(item.ref));
    for (const item of currentRelationships.docs) if (!relationshipIds.has(item.id)) actions.push(batch => batch.delete(item.ref));
    await this.writeChunks(tree.id, actions);
  }

  private async writeChunks(treeId: string, actions: WriteAction[]): Promise<void> {
    if (actions.length <= MAX_BATCH_OPERATIONS) return this.writeActions(actions);
    const operationRef = doc(collection(this.db, "trees", treeId, "operations"));
    await setDoc(operationRef, { status: "pending", totalWrites: actions.length, completedWrites: 0, createdAt: Timestamp.now() });
    for (let offset = 0; offset < actions.length; offset += MAX_BATCH_OPERATIONS) {
      const chunk = actions.slice(offset, offset + MAX_BATCH_OPERATIONS);
      await this.writeActions(chunk);
      await setDoc(operationRef, { status: "pending", totalWrites: actions.length, completedWrites: Math.min(offset + chunk.length, actions.length), createdAt: Timestamp.now() });
    }
    await deleteDoc(operationRef);
  }

  private async writeActions(actions: WriteAction[]): Promise<void> {
    for (let offset = 0; offset < actions.length; offset += MAX_BATCH_OPERATIONS) {
      const batch = writeBatch(this.db);
      actions.slice(offset, offset + MAX_BATCH_OPERATIONS).forEach(action => action(batch));
      await batch.commit();
    }
  }
}

export { ONLINE_TREE_SCHEMA_VERSION };
