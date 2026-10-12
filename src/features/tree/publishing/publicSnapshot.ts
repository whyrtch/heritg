import type { OnlinePerson, OnlineRelationship } from "../domain/onlineTypes";
import { fromOnlineTree } from "../domain/serialization";
import type { PublicTreeSnapshot } from "./PublicationRepository";

/** What a public link shows: the people and relationships of a tree, never the owner or private metadata. */
export type PublicSnapshotBody = {
  people: Omit<OnlinePerson, "updatedAt">[];
  relationships: Omit<OnlineRelationship, "updatedAt">[];
};
/** The same body for a password-protected link, plus embedded photos by person id (data URLs; the link has no photo endpoint). */
export type ProtectedSnapshotBody = PublicSnapshotBody & { photos?: Record<string, string> };

export type PublicSnapshotMeta = { publicId: string; name: string; schemaVersion: number; publishedRevision: number; publishedAt: string };

/** Only the thumbnails the app itself makes (JPEG/WebP, 48 KB); anything else in a decrypted payload is ignored. */
const PHOTO_DATA_URL = /^data:image\/(?:jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/;
const PHOTO_DATA_URL_MAX = 70_000;
export const isPhotoDataUrl = (value: unknown): value is string => typeof value === "string" && value.length <= PHOTO_DATA_URL_MAX && PHOTO_DATA_URL.test(value);

/** Turn a snapshot body into the tree the read-only canvas draws. Throws when the body is not a valid tree. */
export function toPublicTreeSnapshot(meta: PublicSnapshotMeta, body: ProtectedSnapshotBody, photoPath?: (personId: string, version: string) => string): PublicTreeSnapshot {
  const at = meta.publishedAt;
  const tree = fromOnlineTree({
    id: meta.publicId, ownerId: "public-snapshot", name: meta.name, visibility: "unlisted", publicId: meta.publicId,
    revision: meta.publishedRevision, schemaVersion: meta.schemaVersion, createdAt: at, updatedAt: at, publishedRevision: meta.publishedRevision,
    people: body.people.map(person => ({ ...person, updatedAt: at })),
    relationships: body.relationships.map(relationship => ({ ...relationship, updatedAt: at })),
  }, photoPath ? { photoPath } : {});
  const photos = body.photos && typeof body.photos === "object" ? body.photos : {};
  for (const person of tree.people) {
    const data = Object.prototype.hasOwnProperty.call(photos, person.id) ? photos[person.id] : undefined;
    if (isPhotoDataUrl(data)) person.photo = data;
  }
  return { publicId: meta.publicId, name: meta.name, schemaVersion: meta.schemaVersion, publishedRevision: meta.publishedRevision, publishedAt: meta.publishedAt, tree };
}
