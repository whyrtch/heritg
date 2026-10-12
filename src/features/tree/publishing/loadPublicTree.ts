import { HttpPublicationRepository } from "./HttpPublicationRepository";
import type { EncryptedPublicTree, PublicationRepository, PublicTreeSnapshot } from "./PublicationRepository";

export async function loadPublicTree(
  publicId: string,
  repository: PublicationRepository = new HttpPublicationRepository(),
): Promise<PublicTreeSnapshot | EncryptedPublicTree | null> {
  if (!/^[A-Za-z0-9_-]{20,128}$/.test(publicId)) return null;
  return repository.loadPublic(publicId);
}
