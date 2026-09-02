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
  /** Atomically writes the new snapshot and switches the private tree to it. */
  publish(tree: OnlineTree, publicId: string, previousPublicId?: string): Promise<OnlineTree>;
  /** Atomically disables public metadata before making the private tree private. */
  disable(tree: OnlineTree, publicId: string): Promise<OnlineTree>;
  /** Best-effort cleanup that runs only after the public metadata is disabled. */
  cleanupDisabled(publicId: string): Promise<void>;
  /** Reads only publicTrees/{publicId} and its two public subcollections. */
  loadPublic(publicId: string): Promise<PublicTreeSnapshot | null>;
}

export type PublicationResult = {
  tree: OnlineTree;
  cleanupPending: boolean;
};
