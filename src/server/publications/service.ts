import "server-only";
import { and, eq, ne, sql } from "drizzle-orm";
import type { OnlinePerson, OnlineRelationship, OnlineTree } from "@/features/tree/domain/onlineTypes";
import type { Database } from "../db/client";
import { publicPhotos, publications, trees } from "../db/schema";
import { TreeServiceError, loadTree } from "../trees/service";

export const PUBLIC_ID = /^[A-Za-z0-9_-]{20,128}$/;

/** What a public link shows: the tree's people and relationships, never the owner or private metadata. */
export type PublicSnapshotBody = {
  people: Omit<OnlinePerson, "updatedAt">[];
  relationships: Omit<OnlineRelationship, "updatedAt">[];
};
export type PublicSnapshot = { publicId: string; name: string; schemaVersion: number; publishedRevision: number; publishedAt: string } & PublicSnapshotBody;

function snapshotOf(tree: OnlineTree): PublicSnapshotBody {
  return {
    people: tree.people.map(({ updatedAt: _updatedAt, ...person }) => { void _updatedAt; return person; }),
    relationships: tree.relationships.map(({ updatedAt: _updatedAt, ...relationship }) => { void _updatedAt; return relationship; }),
  };
}

const NOT_FOUND = () => new TreeServiceError("not-found", "Family tree was not found.");
const STALE_MESSAGE = "Your latest changes are still being saved (or came from another device). Wait a moment and try again.";

/**
 * Publish (or re-publish) the *stored* tree under `publicId` in one transaction: lock the owner's tree,
 * check the revision, replace the snapshot, and switch the tree to unlisted. A different `publicId` than
 * the current one regenerates the link: the old snapshot is deleted, so the old URL stops working.
 */
export async function publishTree(db: Database, ownerId: string, treeId: string, publicId: string, expectedRevision: number): Promise<OnlineTree> {
  await db.transaction(async tx => {
    const [row] = await tx.select().from(trees).where(and(eq(trees.id, treeId), eq(trees.ownerId, ownerId))).for("update").limit(1);
    if (!row) throw NOT_FOUND();
    if (row.revision !== expectedRevision) throw new TreeServiceError("conflict", STALE_MESSAGE);
    const current = await loadTree(tx as unknown as Database, ownerId, treeId);
    const revision = row.revision + 1, now = new Date();
    // A different id regenerates the link: any other snapshot of this tree is deleted, so its URL stops working.
    await tx.delete(publications).where(and(eq(publications.treeId, row.id), ne(publications.publicId, publicId)));
    const values = { name: row.name, schemaVersion: row.schemaVersion, publishedRevision: revision, publishedAt: now, enabled: true, snapshot: snapshotOf(current) };
    const [saved] = await tx.insert(publications).values({ publicId, treeId: row.id, ...values })
      .onConflictDoUpdate({ target: publications.publicId, set: values, where: eq(publications.treeId, row.id) })
      .returning({ publicId: publications.publicId });
    // Another tree already owns this public id (practically impossible with 128 random bits).
    if (!saved) throw new TreeServiceError("conflict", "This link id is already in use. Try again.");
    // Photos are copied too, so the public copy keeps working (and stays frozen) whatever happens to the tree.
    await tx.delete(publicPhotos).where(eq(publicPhotos.publicId, publicId));
    await tx.execute(sql`insert into public_photos (public_id, person_id, mime, bytes, sha256) select ${publicId}, person_id, mime, bytes, sha256 from photos where tree_id = ${row.id}`);
    await tx.update(trees).set({ visibility: "unlisted", publicId, revision, publishedRevision: revision, updatedAt: now }).where(eq(trees.id, row.id));
  });
  return loadTree(db, ownerId, treeId);
}

/**
 * Revoke the public link: the snapshot is deleted and the tree becomes private, atomically. The revision
 * check refuses to revoke while a save from this device is still on its way (the client would otherwise
 * replay a queued "unlisted" copy and show a link that no longer exists).
 */
export async function unpublishTree(db: Database, ownerId: string, treeId: string, expectedRevision: number): Promise<OnlineTree> {
  await db.transaction(async tx => {
    const [row] = await tx.select().from(trees).where(and(eq(trees.id, treeId), eq(trees.ownerId, ownerId))).for("update").limit(1);
    if (!row) throw NOT_FOUND();
    if (row.revision !== expectedRevision) throw new TreeServiceError("conflict", STALE_MESSAGE);
    await tx.delete(publications).where(eq(publications.treeId, row.id));
    if (row.visibility !== "private") {
      await tx.update(trees).set({ visibility: "private", publicId: null, publishedRevision: null, revision: row.revision + 1, updatedAt: new Date() }).where(eq(trees.id, row.id));
    }
  });
  return loadTree(db, ownerId, treeId);
}

/** Anyone with the link: an enabled snapshot, or null for unknown, disabled and malformed ids alike. */
export async function loadPublicSnapshot(db: Database, publicId: string): Promise<PublicSnapshot | null> {
  if (!PUBLIC_ID.test(publicId)) return null;
  const [row] = await db.select().from(publications).where(and(eq(publications.publicId, publicId), eq(publications.enabled, true))).limit(1);
  if (!row) return null;
  const body = row.snapshot as PublicSnapshotBody;
  return { publicId: row.publicId, name: row.name, schemaVersion: row.schemaVersion, publishedRevision: row.publishedRevision, publishedAt: row.publishedAt.toISOString(), people: body.people, relationships: body.relationships };
}
