import "server-only";
import { and, asc, desc, eq, inArray, notInArray, sql } from "drizzle-orm";
import type { OnlinePerson, OnlineRelationship, OnlineTree } from "@/features/tree/domain/onlineTypes";
import type { Database } from "../db/client";
import { people, relationships, trees } from "../db/schema";
import type { TreeInput } from "./validation";

export class TreeServiceError extends Error {
  constructor(public readonly code: "not-found" | "conflict", message: string, public readonly current?: OnlineTree) {
    super(message);
    this.name = "TreeServiceError";
  }
}

const NOT_FOUND = () => new TreeServiceError("not-found", "Family tree was not found.");
/** Stay well below PostgreSQL's 65,535 bind parameters per statement. */
const CHUNK = 1000;
const chunks = <T>(items: T[]) => Array.from({ length: Math.ceil(items.length / CHUNK) }, (_, index) => items.slice(index * CHUNK, (index + 1) * CHUNK));

type TreeRow = typeof trees.$inferSelect;
type PersonRow = typeof people.$inferSelect;
type RelationshipRow = typeof relationships.$inferSelect;

function toOnline(tree: TreeRow, personRows: PersonRow[], relationshipRows: RelationshipRow[]): OnlineTree {
  const updatedAt = tree.updatedAt.toISOString();
  return {
    id: tree.id, ownerId: tree.ownerId, name: tree.name, visibility: tree.visibility, publicId: tree.publicId,
    revision: tree.revision, schemaVersion: tree.schemaVersion, createdAt: tree.createdAt.toISOString(), updatedAt,
    publishedRevision: tree.publishedRevision,
    people: personRows.sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id)).map((row): OnlinePerson => ({
      id: row.id, name: row.name, gender: row.gender, birthDate: row.birthDate, deathDate: row.deathDate, birthOrder: row.birthOrder,
      residence: row.residence, notes: row.notes, photoUrl: row.photoUrl, sortOrder: row.sortOrder, updatedAt: row.updatedAt.toISOString(),
    })),
    relationships: relationshipRows.map((row): OnlineRelationship => ({
      id: row.id, type: row.type, fromPersonId: row.fromPersonId, toPersonId: row.toPersonId,
      kind: row.kind, status: row.status, marriedOn: row.marriedOn, updatedAt: row.updatedAt.toISOString(),
    })),
  };
}

async function children(db: Database, treeIds: string[]) {
  if (!treeIds.length) return { personRows: [] as PersonRow[], relationshipRows: [] as RelationshipRow[] };
  const [personRows, relationshipRows] = await Promise.all([
    db.select().from(people).where(inArray(people.treeId, treeIds)).orderBy(asc(people.sortOrder)),
    db.select().from(relationships).where(inArray(relationships.treeId, treeIds)),
  ]);
  return { personRows, relationshipRows };
}

/** Every tree of this owner, newest first. */
export async function listOwned(db: Database, ownerId: string): Promise<OnlineTree[]> {
  const rows = await db.select().from(trees).where(eq(trees.ownerId, ownerId)).orderBy(desc(trees.updatedAt));
  const { personRows, relationshipRows } = await children(db, rows.map(row => row.id));
  return rows.map(row => toOnline(row, personRows.filter(item => item.treeId === row.id), relationshipRows.filter(item => item.treeId === row.id)));
}

/** One tree, only if this owner has it; another owner's tree is indistinguishable from a missing one. */
export async function loadTree(db: Database, ownerId: string, treeId: string): Promise<OnlineTree> {
  const [row] = await db.select().from(trees).where(and(eq(trees.id, treeId), eq(trees.ownerId, ownerId))).limit(1);
  if (!row) throw NOT_FOUND();
  const { personRows, relationshipRows } = await children(db, [row.id]);
  return toOnline(row, personRows, relationshipRows);
}

const personValues = (treeId: string, now: Date) => (item: TreeInput["people"][number]) => ({
  treeId, id: item.id, name: item.name, gender: item.gender, birthDate: item.birthDate, deathDate: item.deathDate,
  birthOrder: item.birthOrder, residence: item.residence, notes: item.notes, photoUrl: item.photoUrl, sortOrder: item.sortOrder, updatedAt: now,
});
const relationshipValues = (treeId: string, now: Date) => (item: TreeInput["relationships"][number]) => ({
  treeId, id: item.id, type: item.type, fromPersonId: item.fromPersonId, toPersonId: item.toPersonId,
  kind: item.kind, status: item.status, marriedOn: item.marriedOn, updatedAt: now,
});

/** Create a tree with a client-chosen id. The owner's own existing id is a conflict (resumable migrations). */
export async function createTree(db: Database, ownerId: string, input: TreeInput): Promise<OnlineTree> {
  const now = new Date();
  await db.transaction(async tx => {
    const [inserted] = await tx.insert(trees).values({ id: input.id, ownerId, name: input.name, schemaVersion: input.schemaVersion, revision: 0, createdAt: now, updatedAt: now })
      .onConflictDoNothing({ target: trees.id }).returning({ id: trees.id });
    if (!inserted) {
      const [existing] = await tx.select({ ownerId: trees.ownerId }).from(trees).where(eq(trees.id, input.id)).limit(1);
      throw existing?.ownerId === ownerId ? new TreeServiceError("conflict", "A family tree with this ID already exists.") : NOT_FOUND();
    }
    for (const part of chunks(input.people)) await tx.insert(people).values(part.map(personValues(input.id, now)));
    for (const part of chunks(input.relationships)) await tx.insert(relationships).values(part.map(relationshipValues(input.id, now)));
  });
  return loadTree(db, ownerId, input.id);
}

/**
 * Save a whole tree if nobody saved since `expectedRevision`. One transaction: lock the tree row, check
 * the revision, remove what is gone, upsert the rest, bump the revision. A conflict carries the current tree.
 */
export async function saveTree(db: Database, ownerId: string, input: TreeInput, expectedRevision: number): Promise<OnlineTree> {
  const now = new Date();
  await db.transaction(async tx => {
    const [row] = await tx.select().from(trees).where(and(eq(trees.id, input.id), eq(trees.ownerId, ownerId))).for("update").limit(1);
    if (!row) throw NOT_FOUND();
    if (row.revision !== expectedRevision) throw new TreeServiceError("conflict", "The family tree was updated elsewhere.");
    const personIds = input.people.map(item => item.id), relationshipIds = input.relationships.map(item => item.id);
    await tx.delete(relationships).where(and(eq(relationships.treeId, row.id), relationshipIds.length ? notInArray(relationships.id, relationshipIds) : sql`true`));
    await tx.delete(people).where(and(eq(people.treeId, row.id), personIds.length ? notInArray(people.id, personIds) : sql`true`));
    for (const part of chunks(input.people)) {
      await tx.insert(people).values(part.map(personValues(row.id, now))).onConflictDoUpdate({
        target: [people.treeId, people.id],
        set: { name: sql`excluded.name`, gender: sql`excluded.gender`, birthDate: sql`excluded.birth_date`, deathDate: sql`excluded.death_date`, birthOrder: sql`excluded.birth_order`, residence: sql`excluded.residence`, notes: sql`excluded.notes`, photoUrl: sql`excluded.photo_url`, sortOrder: sql`excluded.sort_order`, updatedAt: now },
      });
    }
    for (const part of chunks(input.relationships)) {
      await tx.insert(relationships).values(part.map(relationshipValues(row.id, now))).onConflictDoUpdate({
        target: [relationships.treeId, relationships.id],
        set: { type: sql`excluded.type`, fromPersonId: sql`excluded.from_person_id`, toPersonId: sql`excluded.to_person_id`, kind: sql`excluded.kind`, status: sql`excluded.status`, marriedOn: sql`excluded.married_on`, updatedAt: now },
      });
    }
    await tx.update(trees).set({ name: input.name, schemaVersion: input.schemaVersion, revision: row.revision + 1, updatedAt: now }).where(eq(trees.id, row.id));
  }).catch(async (error: unknown) => {
    if (error instanceof TreeServiceError && error.code === "conflict") throw new TreeServiceError("conflict", error.message, await loadTree(db, ownerId, input.id));
    throw error;
  });
  return loadTree(db, ownerId, input.id);
}

export async function deleteTree(db: Database, ownerId: string, treeId: string): Promise<void> {
  const deleted = await db.delete(trees).where(and(eq(trees.id, treeId), eq(trees.ownerId, ownerId))).returning({ id: trees.id });
  if (!deleted.length) throw NOT_FOUND();
}
