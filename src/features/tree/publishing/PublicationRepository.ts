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

export interface PublicationRepository {
  /**
   * Snapshot the stored tree under `publicId` and switch the tree to it, atomically. A different id than
   * the current one regenerates the link (the server deletes the old copy in the same transaction).
   */
  publish(tree: OnlineTree, publicId: string): Promise<OnlineTree>;
  /** Revoke the link: the snapshot is deleted and the tree becomes private, atomically. */
  disable(tree: OnlineTree): Promise<OnlineTree>;
  /** Read an enabled public snapshot, or null for unknown, revoked and malformed links alike. */
  loadPublic(publicId: string): Promise<PublicTreeSnapshot | null>;
}
