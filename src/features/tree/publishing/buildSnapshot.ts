import type { OnlineTree } from "../domain/onlineTypes";
import { encryptText, toBase64, type EncryptedEnvelope } from "../domain/secureFile";
import { ownerPhotoPath } from "../domain/serialization";
import type { PublishOptions } from "./PublicationRepository";
import { isPhotoDataUrl, type ProtectedSnapshotBody } from "./publicSnapshot";

/** The most base64 characters of ciphertext the server keeps for one link. Keep in sync with CIPHERTEXT_MAX_CHARS on the server. */
export const LINK_CIPHERTEXT_MAX_CHARS = 4_000_000;

/** The tree (with its photos) is too large for a password-protected link. */
export class SnapshotTooLargeError extends Error {
  constructor() { super("This family tree is too large for a password-protected link."); this.name = "SnapshotTooLargeError"; }
}

/**
 * The public snapshot, built in the browser with the same shape and the same option rules as the server's plain
 * snapshot (src/server/publications/service.ts): no owner data, dates blanked when off, marriage dates blanked
 * when off, photo fields blanked when off. `photos` holds uploaded thumbnails by person id as data URLs; they
 * travel inside the encrypted payload because a protected link has no photo endpoint. External HTTPS photo
 * links stay links (the viewer's browser loads them, as it does for a plain link).
 */
export function buildSnapshot(tree: OnlineTree, options: PublishOptions, photos: Record<string, string> = {}): ProtectedSnapshotBody {
  const people = tree.people.map(({ updatedAt: _updatedAt, ...person }) => {
    void _updatedAt;
    return {
      ...person,
      ...(options.dates ? {} : { birthDate: "", deathDate: "", birthOrder: null }),
      // A protected link never has server photos, so the version is always dropped.
      photoVersion: null,
      ...(options.photos ? {} : { photoUrl: "" }),
    };
  });
  const relationships = tree.relationships.map(({ updatedAt: _updatedAt, ...relationship }) => {
    void _updatedAt;
    return options.marriageDates ? relationship : { ...relationship, marriedOn: "" };
  });
  const embedded: Record<string, string> = {};
  if (options.photos) for (const person of people) if (isPhotoDataUrl(photos[person.id])) embedded[person.id] = photos[person.id];
  return { people, relationships, ...(Object.keys(embedded).length ? { photos: embedded } : {}) };
}

const toDataUrl = async (blob: Blob) => `data:${blob.type};base64,${toBase64(new Uint8Array(await blob.arrayBuffer()))}`;

/** The owner's uploaded thumbnails as data URLs. A photo that cannot be fetched is left out (the person simply has none). */
export async function fetchPhotoDataUrls(tree: OnlineTree, fetchImpl: typeof fetch = (...args) => fetch(...args)): Promise<Record<string, string>> {
  const found: Record<string, string> = {};
  await Promise.all(tree.people.map(async person => {
    if (!person.photoVersion) return;
    try {
      const response = await fetchImpl(ownerPhotoPath(tree.id, person.id, person.photoVersion), { credentials: "same-origin" });
      if (!response.ok) return;
      const data = await toDataUrl(await response.blob());
      if (isPhotoDataUrl(data)) found[person.id] = data;
    } catch { /* leave this photo out */ }
  }));
  return found;
}

/** Base64 characters needed for `bytes` of plaintext once AES-GCM adds its 16-byte tag. */
const encodedLength = (bytes: number) => Math.ceil((bytes + 16) / 3) * 4;

/**
 * Build, encrypt and size-check the snapshot. The password stays in this function: it is used only to derive the
 * key in the browser and is never sent, stored or logged.
 */
export async function encryptSnapshot(
  tree: OnlineTree, options: PublishOptions, password: string,
  { fetchImpl, iterations }: { fetchImpl?: typeof fetch; iterations?: number } = {},
): Promise<EncryptedEnvelope> {
  const photos = options.photos ? await fetchPhotoDataUrls(tree, fetchImpl) : {};
  const plain = JSON.stringify(buildSnapshot(tree, options, photos));
  if (encodedLength(new TextEncoder().encode(plain).length) > LINK_CIPHERTEXT_MAX_CHARS) throw new SnapshotTooLargeError();
  const envelope = await encryptText(plain, password, iterations === undefined ? {} : { iterations });
  if (envelope.data.length > LINK_CIPHERTEXT_MAX_CHARS) throw new SnapshotTooLargeError();
  return envelope;
}
