import { FirestorePublicationRepository } from "./FirestorePublicationRepository";
import type { PublicationRepository, PublicTreeSnapshot } from "./PublicationRepository";

export async function loadPublicTree(
  publicId: string,
  repository: PublicationRepository = new FirestorePublicationRepository(),
): Promise<PublicTreeSnapshot | null> {
  if (!/^[A-Za-z0-9_-]{20,128}$/.test(publicId)) return null;
  return repository.loadPublic(publicId);
}
