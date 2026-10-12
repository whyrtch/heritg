import type { OnlineTree } from "../domain/onlineTypes";
import { fromOnlineTree } from "../domain/serialization";
import type { PublicationRepository, PublicTreeSnapshot } from "./PublicationRepository";

type Fetch = typeof fetch;
type PublicSnapshotResponse = {
  publicId: string; name: string; schemaVersion: number; publishedRevision: number; publishedAt: string;
  people: Omit<OnlineTree["people"][number], "updatedAt">[];
  relationships: Omit<OnlineTree["relationships"][number], "updatedAt">[];
};

/** Publishing through our API. The server snapshots the *stored* tree, so unsaved local edits are not shared. */
export class HttpPublicationRepository implements PublicationRepository {
  constructor(private readonly fetchImpl: Fetch = (...args) => fetch(...args)) {}

  private async tree(path: string, init: RequestInit): Promise<OnlineTree> {
    const response = await this.fetchImpl(path, { ...init, credentials: "same-origin", headers: { Accept: "application/json", ...(init.body ? { "Content-Type": "application/json" } : {}) } });
    const body = await response.json().catch(() => null) as { tree?: OnlineTree; error?: { message?: string } } | null;
    if (!response.ok || !body?.tree) throw new Error(body?.error?.message ?? "The public link could not be updated.");
    return body.tree;
  }

  publish(tree: OnlineTree, publicId: string): Promise<OnlineTree> {
    return this.tree(`/api/trees/${encodeURIComponent(tree.id)}/publication`, { method: "PUT", body: JSON.stringify({ publicId, expectedRevision: tree.revision }) });
  }

  disable(tree: OnlineTree): Promise<OnlineTree> {
    return this.tree(`/api/trees/${encodeURIComponent(tree.id)}/publication`, { method: "DELETE", body: JSON.stringify({ expectedRevision: tree.revision }) });
  }

  async loadPublic(publicId: string): Promise<PublicTreeSnapshot | null> {
    try {
      const response = await this.fetchImpl(`/api/public/${encodeURIComponent(publicId)}`, { headers: { Accept: "application/json" }, credentials: "omit" });
      if (!response.ok) return null;
      const { snapshot } = await response.json() as { snapshot: PublicSnapshotResponse };
      const at = snapshot.publishedAt;
      const tree = fromOnlineTree({
        id: snapshot.publicId, ownerId: "public-snapshot", name: snapshot.name, visibility: "unlisted", publicId: snapshot.publicId,
        revision: snapshot.publishedRevision, schemaVersion: snapshot.schemaVersion, createdAt: at, updatedAt: at, publishedRevision: snapshot.publishedRevision,
        people: snapshot.people.map(person => ({ ...person, updatedAt: at })),
        relationships: snapshot.relationships.map(relationship => ({ ...relationship, updatedAt: at })),
      }, { photoPath: (personId, version) => `/api/public/${encodeURIComponent(snapshot.publicId)}/photos/${encodeURIComponent(personId)}?v=${encodeURIComponent(version)}` });
      return { publicId: snapshot.publicId, name: snapshot.name, schemaVersion: snapshot.schemaVersion, publishedRevision: snapshot.publishedRevision, publishedAt: at, tree };
    } catch {
      // Unknown, disabled, malformed and offline links are deliberately indistinguishable.
      return null;
    }
  }
}
