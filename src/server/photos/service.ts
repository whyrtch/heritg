import "server-only";
import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import type { Database } from "../db/client";
import { PHOTO_MAX_BYTES, photos, publicPhotos, publications, trees } from "../db/schema";
import { notExpired } from "../publications/service";
import { TreeServiceError } from "../trees/service";

export { PHOTO_MAX_BYTES };
export type PhotoMime = "image/jpeg" | "image/webp";
export type StoredPhoto = { mime: PhotoMime; bytes: Uint8Array; sha256: string };

/** The version the browser puts in photo URLs (?v=…): changes whenever the bytes change. */
export const photoVersion = (sha256: string) => sha256.slice(0, 16);

/** Identify an image by its first bytes, never by the declared Content-Type. */
export function sniffImage(bytes: Uint8Array): PhotoMime | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.slice(from, to));
  if (bytes.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  return null;
}

const NOT_FOUND = () => new TreeServiceError("not-found", "Photo was not found.");

async function assertOwnsTree(db: Database, ownerId: string, treeId: string): Promise<void> {
  const [row] = await db.select({ id: trees.id }).from(trees).where(and(eq(trees.id, treeId), eq(trees.ownerId, ownerId))).limit(1);
  if (!row) throw NOT_FOUND();
}

/** Store (or replace) a person's thumbnail. The person must already exist on the server. */
export async function putPhoto(db: Database, ownerId: string, treeId: string, personId: string, bytes: Uint8Array, mime: PhotoMime): Promise<string> {
  await assertOwnsTree(db, ownerId, treeId);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  try {
    await db.insert(photos).values({ treeId, personId, mime, bytes, sha256, updatedAt: new Date() })
      .onConflictDoUpdate({ target: [photos.treeId, photos.personId], set: { mime, bytes, sha256, updatedAt: new Date() } });
  } catch (error) {
    // Foreign key: the person is not (yet) part of this tree on the server.
    if ((error as { code?: string; cause?: { code?: string } }).code === "23503" || (error as { cause?: { code?: string } }).cause?.code === "23503") throw NOT_FOUND();
    throw error;
  }
  return photoVersion(sha256);
}

export async function getPhoto(db: Database, ownerId: string, treeId: string, personId: string): Promise<StoredPhoto> {
  await assertOwnsTree(db, ownerId, treeId);
  const [row] = await db.select({ mime: photos.mime, bytes: photos.bytes, sha256: photos.sha256 }).from(photos).where(and(eq(photos.treeId, treeId), eq(photos.personId, personId))).limit(1);
  if (!row) throw NOT_FOUND();
  return row;
}

export async function deletePhoto(db: Database, ownerId: string, treeId: string, personId: string): Promise<void> {
  await assertOwnsTree(db, ownerId, treeId);
  await db.delete(photos).where(and(eq(photos.treeId, treeId), eq(photos.personId, personId)));
}

/** A photo of an enabled public snapshot, or null (unknown, revoked and missing look the same). */
export async function getPublicPhoto(db: Database, publicId: string, personId: string): Promise<StoredPhoto | null> {
  const [row] = await db.select({ mime: publicPhotos.mime, bytes: publicPhotos.bytes, sha256: publicPhotos.sha256 }).from(publicPhotos)
    .innerJoin(publications, eq(publications.publicId, publicPhotos.publicId))
    .where(and(eq(publicPhotos.publicId, publicId), eq(publicPhotos.personId, personId), eq(publications.enabled, true), notExpired())).limit(1);
  return row ?? null;
}
