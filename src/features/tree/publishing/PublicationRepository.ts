import type { FamilyTree } from "../model";
import type { OnlineTree } from "../domain/onlineTypes";

export type PublicTreeSnapshot = {
  publicId: string;
  name: string;
  schemaVersion: number;
  publishedRevision: number;
  publishedAt: string;
  tree: FamilyTree;
};

/** What a link shows besides names, gender and relationships (always shown). */
export type PublishOptions = { dates: boolean; marriageDates: boolean; photos: boolean };
export type ExpiryDays = 7 | 30 | 90 | null;
/** Omitted fields keep what the link already has on the server; `expiresInDays: null` clears the expiry. */
export type PublishSettings = { options?: PublishOptions; expiresInDays?: ExpiryDays };
export const DEFAULT_PUBLISH_OPTIONS: PublishOptions = { dates: true, marriageDates: true, photos: true };
/** The owner's view of a link's settings. */
export type PublicationInfo = { options: PublishOptions; expiresAt: string | null };

export interface PublicationRepository {
  /**
   * Snapshot the stored tree under `publicId` and switch the tree to it, atomically. A different id than
   * the current one regenerates the link (the server deletes the old copy in the same transaction).
   */
  publish(tree: OnlineTree, publicId: string, settings?: PublishSettings): Promise<OnlineTree>;
  /** The settings of the tree's current link, or null when it has none. */
  getPublication(tree: OnlineTree): Promise<PublicationInfo | null>;
  /** Revoke the link: the snapshot is deleted and the tree becomes private, atomically. */
  disable(tree: OnlineTree): Promise<OnlineTree>;
  /** Read an enabled public snapshot, or null for unknown, revoked and malformed links alike. */
  loadPublic(publicId: string): Promise<PublicTreeSnapshot | null>;
}
