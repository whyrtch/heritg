import type { FamilyTree } from "../model";
import type { OnlineTree } from "../domain/onlineTypes";
import type { EncryptedEnvelope } from "../domain/secureFile";

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
export type PublishSettings = {
  options?: PublishOptions;
  expiresInDays?: ExpiryDays;
  /** Password mode: the snapshot, already encrypted in the browser. The password itself never reaches the repository. */
  encrypted?: EncryptedEnvelope;
  /** "plain" turns a password-protected link into an open one; leaving it out keeps the link's current mode. */
  mode?: "plain";
};
export type LinkMode = "plain" | "password";
export const DEFAULT_PUBLISH_OPTIONS: PublishOptions = { dates: true, marriageDates: true, photos: true };
/** The owner's view of a link's settings. */
export type PublicationInfo = { options: PublishOptions; expiresAt: string | null; mode: LinkMode };

/** A password-protected link as the viewer first receives it: only the name is readable. */
export type EncryptedPublicTree = { encrypted: true; publicId: string; name: string; envelope: EncryptedEnvelope };
export const isEncryptedPublicTree = (value: PublicTreeSnapshot | EncryptedPublicTree): value is EncryptedPublicTree => "encrypted" in value;

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
  /** Read an enabled public link (a snapshot, or a locked envelope), or null for unknown, revoked, expired and malformed links alike. */
  loadPublic(publicId: string): Promise<PublicTreeSnapshot | EncryptedPublicTree | null>;
}
