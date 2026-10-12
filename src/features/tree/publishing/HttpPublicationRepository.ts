import type { OnlineTree } from "../domain/onlineTypes";
import type { EncryptedEnvelope } from "../domain/secureFile";
import type { EncryptedPublicTree, PublicationInfo, PublicationRepository, PublicTreeSnapshot, PublishSettings } from "./PublicationRepository";
import { toPublicTreeSnapshot, type PublicSnapshotBody, type PublicSnapshotMeta } from "./publicSnapshot";

type Fetch = typeof fetch;
type PublicSnapshotResponse = PublicSnapshotMeta & PublicSnapshotBody;
type EncryptedResponse = { encrypted: true; name: string; envelope: EncryptedEnvelope };

/** Publishing through our API. The server snapshots the *stored* tree, so unsaved local edits are not shared. */
export class HttpPublicationRepository implements PublicationRepository {
  constructor(private readonly fetchImpl: Fetch = (...args) => fetch(...args)) {}

  private async tree(path: string, init: RequestInit): Promise<OnlineTree> {
    const response = await this.fetchImpl(path, { ...init, credentials: "same-origin", headers: { Accept: "application/json", ...(init.body ? { "Content-Type": "application/json" } : {}) } });
    const body = await response.json().catch(() => null) as { tree?: OnlineTree; error?: { message?: string } } | null;
    if (!response.ok || !body?.tree) throw new Error(body?.error?.message ?? "The public link could not be updated.");
    return body.tree;
  }

  publish(tree: OnlineTree, publicId: string, settings?: PublishSettings): Promise<OnlineTree> {
    return this.tree(`/api/trees/${encodeURIComponent(tree.id)}/publication`, { method: "PUT", body: JSON.stringify({ publicId, expectedRevision: tree.revision, ...(settings ? { options: settings.options, expiresInDays: settings.expiresInDays } : {}),
      ...(settings?.encrypted ? { mode: "password", envelope: settings.encrypted } : settings?.mode === "plain" ? { mode: "plain" } : {}) }) });
  }

  async getPublication(tree: OnlineTree): Promise<PublicationInfo | null> {
    const response = await this.fetchImpl(`/api/trees/${encodeURIComponent(tree.id)}/publication`, { credentials: "same-origin", headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error("The link settings could not be loaded.");
    const body = await response.json().catch(() => null) as { publication?: PublicationInfo | null } | null;
    return body?.publication ?? null;
  }

  disable(tree: OnlineTree): Promise<OnlineTree> {
    return this.tree(`/api/trees/${encodeURIComponent(tree.id)}/publication`, { method: "DELETE", body: JSON.stringify({ expectedRevision: tree.revision }) });
  }

  async loadPublic(publicId: string): Promise<PublicTreeSnapshot | EncryptedPublicTree | null> {
    try {
      const response = await this.fetchImpl(`/api/public/${encodeURIComponent(publicId)}`, { headers: { Accept: "application/json" }, credentials: "omit" });
      if (!response.ok) return null;
      const body = await response.json() as { snapshot?: PublicSnapshotResponse } & Partial<EncryptedResponse>;
      // A password-protected link: only the name is readable until the viewer decrypts in the browser.
      if (body.encrypted === true && body.envelope && typeof body.name === "string") return { encrypted: true, publicId, name: body.name, envelope: body.envelope };
      const snapshot = body.snapshot!;
      return toPublicTreeSnapshot(snapshot, snapshot, (personId, version) => `/api/public/${encodeURIComponent(snapshot.publicId)}/photos/${encodeURIComponent(personId)}?v=${encodeURIComponent(version)}`);
    } catch {
      // Unknown, disabled, malformed and offline links are deliberately indistinguishable.
      return null;
    }
  }
}
