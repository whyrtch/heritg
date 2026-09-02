import type { OnlineTree } from "../domain/onlineTypes";
import { generatePublicId } from "./publicId";
import type { PublicationRepository, PublicationResult } from "./PublicationRepository";

export async function publishTree(
  repository: PublicationRepository,
  tree: OnlineTree,
): Promise<OnlineTree> {
  if (tree.visibility === "unlisted" && tree.publicId) return updatePublishedTree(repository, tree);
  return repository.publish(tree, generatePublicId());
}

export async function updatePublishedTree(
  repository: PublicationRepository,
  tree: OnlineTree,
): Promise<OnlineTree> {
  if (tree.visibility !== "unlisted" || !tree.publicId) {
    throw new Error("This family tree does not have an active public link.");
  }
  return repository.publish(tree, tree.publicId);
}

export async function unpublishTree(
  repository: PublicationRepository,
  tree: OnlineTree,
): Promise<PublicationResult> {
  if (tree.visibility !== "unlisted" || !tree.publicId) return { tree, cleanupPending: false };
  const oldPublicId = tree.publicId;
  const privateTree = await repository.disable(tree, oldPublicId);
  try {
    await repository.cleanupDisabled(oldPublicId);
    return { tree: privateTree, cleanupPending: false };
  } catch {
    // Access is already revoked by disable(); cleanup can safely be retried.
    return { tree: privateTree, cleanupPending: true };
  }
}

export async function regeneratePublicId(
  repository: PublicationRepository,
  tree: OnlineTree,
): Promise<PublicationResult> {
  if (tree.visibility !== "unlisted" || !tree.publicId) {
    throw new Error("Publish this family tree before regenerating its link.");
  }
  const oldPublicId = tree.publicId;
  const newTree = await repository.publish(tree, generatePublicId(), oldPublicId);
  try {
    await repository.cleanupDisabled(oldPublicId);
    return { tree: newTree, cleanupPending: false };
  } catch {
    return { tree: newTree, cleanupPending: true };
  }
}
