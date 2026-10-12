import "server-only";
import { and, eq, gt, isNull, ne, or, sql } from "drizzle-orm";
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

/** What a link shows beyond names, gender and relationships (those are always shown). */
export type PublishOptions = { dates: boolean; marriageDates: boolean; photos: boolean };
export const DEFAULT_OPTIONS: PublishOptions = { dates: true, marriageDates: true, photos: true };
/** Omitted fields keep what the link already has (defaults apply only to the first publish); `expiresInDays: null` clears the expiry. */
export type PublishSettings = { options?: PublishOptions; expiresInDays?: number | null };
/** The owner's view of a publication: never part of the public response. */
export type PublicationInfo = { options: PublishOptions; expiresAt: string | null };

/** Only the options an owner may set, whatever the stored JSON holds. */
function optionsOf(value: unknown): PublishOptions {
  const raw = (value && typeof value === "object" ? value : {}) as Partial<Record<keyof PublishOptions, unknown>>;
  return { dates: raw.dates !== false, marriageDates: raw.marriageDates !== false, photos: raw.photos !== false };
}

function snapshotOf(tree: OnlineTree, options: PublishOptions): PublicSnapshotBody {
  return {
    people: tree.people.map(({ updatedAt: _updatedAt, ...person }) => {
      void _updatedAt;
      return {
        ...person,
        ...(options.dates ? {} : { birthDate: "", deathDate: "", birthOrder: null }),
        ...(options.photos ? {} : { photoUrl: "", photoVersion: null }),
      };
    }),
    relationships: tree.relationships.map(({ updatedAt: _updatedAt, ...relationship }) => {
      void _updatedAt;
      return options.marriageDates ? relationship : { ...relationship, marriedOn: "" };
    }),
  };
}

/** A link that has not expired yet; evaluated by the database so every public read uses the same clock. */
export const notExpired = () => or(isNull(publications.expiresAt), gt(publications.expiresAt, sql`now()`));

const NOT_FOUND = () => new TreeServiceError("not-found", "Family tree was not found.");
const STALE_MESSAGE = "Your latest changes are still being saved (or came from another device). Wait a moment and try again.";

/**
 * Publish (or re-publish) the *stored* tree under `publicId` in one transaction: lock the owner's tree,
 * check the revision, replace the snapshot, and switch the tree to unlisted. A different `publicId` than
 * the current one regenerates the link: the old snapshot is deleted, so the old URL stops working.
 */
export async function publishTree(db: Database, ownerId: string, treeId: string, publicId: string, expectedRevision: number, settings: PublishSettings = {}): Promise<OnlineTree> {
  await db.transaction(async tx => {
    const [row] = await tx.select().from(trees).where(and(eq(trees.id, treeId), eq(trees.ownerId, ownerId))).for("update").limit(1);
    if (!row) throw NOT_FOUND();
    if (row.revision !== expectedRevision) throw new TreeServiceError("conflict", STALE_MESSAGE);
    const current = await loadTree(tx as unknown as Database, ownerId, treeId);
    // Read the stored settings under the tree lock and before a regenerate deletes the old row.
    const [existing] = await tx.select({ options: publications.options, expiresAt: publications.expiresAt }).from(publications).where(eq(publications.treeId, row.id)).limit(1);
    const options = settings.options ?? (existing ? optionsOf(existing.options) : DEFAULT_OPTIONS);
    const { expiresInDays } = settings;
    const revision = row.revision + 1, now = new Date();
    // A different id regenerates the link: any other snapshot of this tree is deleted, so its URL stops working.
    await tx.delete(publications).where(and(eq(publications.treeId, row.id), ne(publications.publicId, publicId)));
    const values = { name: row.name, schemaVersion: row.schemaVersion, publishedRevision: revision, publishedAt: now, enabled: true, snapshot: snapshotOf(current, options), options,
      expiresAt: expiresInDays === undefined ? (existing?.expiresAt ?? null) : expiresInDays === null ? null : sql`now() + (${expiresInDays} * interval '1 day')` };
    const [saved] = await tx.insert(publications).values({ publicId, treeId: row.id, ...values })
      .onConflictDoUpdate({ target: publications.publicId, set: values, where: eq(publications.treeId, row.id) })
      .returning({ publicId: publications.publicId });
    // Another tree already owns this public id (practically impossible with 128 random bits).
    if (!saved) throw new TreeServiceError("conflict", "This link id is already in use. Try again.");
    // Photos are copied too, so the public copy keeps working (and stays frozen) whatever happens to the tree.
    await tx.delete(publicPhotos).where(eq(publicPhotos.publicId, publicId));
    if (options.photos) await tx.execute(sql`insert into public_photos (public_id, person_id, mime, bytes, sha256) select ${publicId}, person_id, mime, bytes, sha256 from photos where tree_id = ${row.id}`);
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

/** The owner's settings for the tree's link, or null when it has none (also for another owner's tree). */
export async function getPublication(db: Database, ownerId: string, treeId: string): Promise<PublicationInfo | null> {
  const [row] = await db.select({ options: publications.options, expiresAt: publications.expiresAt }).from(publications)
    .innerJoin(trees, eq(trees.id, publications.treeId))
    .where(and(eq(publications.treeId, treeId), eq(trees.ownerId, ownerId))).limit(1);
  return row ? { options: optionsOf(row.options), expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null } : null;
}

/** Anyone with the link: an enabled, unexpired snapshot, or null for unknown, disabled, expired and malformed ids alike. */
export async function loadPublicSnapshot(db: Database, publicId: string): Promise<PublicSnapshot | null> {
  if (!PUBLIC_ID.test(publicId)) return null;
  const [row] = await db.select().from(publications).where(and(eq(publications.publicId, publicId), eq(publications.enabled, true), notExpired())).limit(1);
  if (!row) return null;
  const body = row.snapshot as PublicSnapshotBody;
  return { publicId: row.publicId, name: row.name, schemaVersion: row.schemaVersion, publishedRevision: row.publishedRevision, publishedAt: row.publishedAt.toISOString(), people: body.people, relationships: body.relationships };
}
