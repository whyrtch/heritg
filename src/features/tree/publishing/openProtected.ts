import { decryptText } from "../domain/secureFile";
import type { EncryptedPublicTree, PublicTreeSnapshot } from "./PublicationRepository";
import { toPublicTreeSnapshot, type ProtectedSnapshotBody } from "./publicSnapshot";

/** The decrypted payload is not a family tree this app understands. */
export class DamagedSnapshotError extends Error {
  constructor() { super("This protected family tree is damaged or not supported."); this.name = "DamagedSnapshotError"; }
}

/**
 * Decrypt a password-protected link in the browser and turn it into the tree to draw. Nothing is sent anywhere.
 * Throws WrongPasswordError for a wrong password, MalformedEnvelopeError for a bad envelope and DamagedSnapshotError
 * for content that decrypts but is not a tree.
 */
export async function openProtected(link: EncryptedPublicTree, password: string): Promise<PublicTreeSnapshot> {
  const plain = await decryptText(link.envelope, password);
  let body: unknown;
  try { body = JSON.parse(plain); } catch { throw new DamagedSnapshotError(); }
  if (!body || typeof body !== "object" || !Array.isArray((body as ProtectedSnapshotBody).people) || !Array.isArray((body as ProtectedSnapshotBody).relationships)) throw new DamagedSnapshotError();
  try {
    // No publication date travels with the link; the version line is hidden when the revision is 0.
    return toPublicTreeSnapshot({ publicId: link.publicId, name: link.name, schemaVersion: 2, publishedRevision: 0, publishedAt: new Date().toISOString() }, body as ProtectedSnapshotBody);
  } catch {
    throw new DamagedSnapshotError();
  }
}
