import type { OnlineTree } from "../domain/onlineTypes";
import { generatePublicId } from "./publicId";
import type { PublicationRepository, PublishSettings } from "./PublicationRepository";

/** Share the tree: keep the current link if there is one, otherwise create an unguessable one. */
export async function publishTree(repository: PublicationRepository, tree: OnlineTree, settings?: PublishSettings): Promise<OnlineTree> {
  if (tree.visibility === "unlisted" && tree.publicId) return updatePublishedTree(repository, tree, settings);
  return repository.publish(tree, generatePublicId(), settings);
}

/** Refresh the public copy with the latest saved version, under the same link. */
export async function updatePublishedTree(repository: PublicationRepository, tree: OnlineTree, settings?: PublishSettings): Promise<OnlineTree> {
  if (tree.visibility !== "unlisted" || !tree.publicId) throw new Error("This family tree does not have an active public link.");
  return repository.publish(tree, tree.publicId, settings);
}

/** Revoke the link; the server deletes the public copy at the same moment. */
export async function unpublishTree(repository: PublicationRepository, tree: OnlineTree): Promise<OnlineTree> {
  if (tree.visibility !== "unlisted" || !tree.publicId) return tree;
  return repository.disable(tree);
}

/** Move the share to a new link; the old link stops working immediately. */
export async function regeneratePublicId(repository: PublicationRepository, tree: OnlineTree, settings?: PublishSettings): Promise<OnlineTree> {
  if (tree.visibility !== "unlisted" || !tree.publicId) throw new Error("Publish this family tree before regenerating its link.");
  return repository.publish(tree, generatePublicId(), settings);
}
