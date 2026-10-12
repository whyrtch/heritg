"use client";

import type { OnlineTree } from "../domain/onlineTypes";
import type { PublicationRepository, PublicTreeSnapshot } from "./PublicationRepository";
import { fromOnlineTree } from "../domain/serialization";
import { ONLINE_TREE_SCHEMA_VERSION } from "../domain/onlineTypes";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8081/api/v1";

async function apiFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...options.headers as Record<string, string>,
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  const response = await fetch(url, { ...options, headers });
  if (response.status === 401) {
    if (typeof window !== "undefined") {
      localStorage.removeItem("auth_token");
    }
    throw new Error("Unauthorized");
  }
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
  return response.json();
}

export class BackendPublicationRepository implements PublicationRepository {
  async publish(tree: OnlineTree, publicId: string, _previousPublicId?: string): Promise<OnlineTree> {
    const result = await apiFetch<{
      tree: {
        id: string;
        owner_id: string;
        name: string;
        description: string;
        is_public: boolean;
        public_link_id: string | null;
        created_at: string;
        updated_at: string;
      };
      public_id: string;
      url: string;
    }>(`${API_URL}/trees/${tree.id}/publish`, {
      method: "POST",
    });

    return {
      id: result.tree.id,
      ownerId: result.tree.owner_id,
      name: result.tree.name,
      visibility: "unlisted",
      publicId: result.public_id,
      revision: tree.revision + 1,
      schemaVersion: ONLINE_TREE_SCHEMA_VERSION,
      createdAt: result.tree.created_at,
      updatedAt: result.tree.updated_at,
      publishedRevision: tree.revision + 1,
      people: tree.people,
      relationships: tree.relationships,
    };
  }

  async disable(tree: OnlineTree, _publicId: string): Promise<OnlineTree> {
    const result = await apiFetch<{
      id: string;
      owner_id: string;
      name: string;
      description: string;
      is_public: boolean;
      public_link_id: string | null;
      created_at: string;
      updated_at: string;
    }>(`${API_URL}/trees/${tree.id}/publish`, {
      method: "DELETE",
    });

    return {
      id: result.id,
      ownerId: result.owner_id,
      name: result.name,
      visibility: "private",
      publicId: null,
      revision: tree.revision + 1,
      schemaVersion: ONLINE_TREE_SCHEMA_VERSION,
      createdAt: result.created_at,
      updatedAt: result.updated_at,
      publishedRevision: null,
      people: tree.people,
      relationships: tree.relationships,
    };
  }

  async cleanupDisabled(_publicId: string): Promise<void> {
    // No cleanup needed for backend implementation
  }

  async loadPublic(publicId: string): Promise<PublicTreeSnapshot | null> {
    try {
      const data = await apiFetch<{
        tree: {
          id: string;
          owner_id: string;
          name: string;
          description: string;
          is_public: boolean;
          created_at: string;
          updated_at: string;
        };
        people: Array<{
          id: string;
          name: string;
          birth_date: string | null;
          death_date: string | null;
          photo_url: string;
          notes: string;
        }>;
        rels: Array<{
          id: string;
          type: string;
          person1_id: string;
          person2_id: string;
        }>;
      }>(`${API_URL}/trees/public/${publicId}`);

      const tree = fromOnlineTree({
        id: data.tree.id,
        ownerId: data.tree.owner_id,
        name: data.tree.name,
        visibility: "unlisted",
        publicId: publicId,
        revision: 1,
        schemaVersion: ONLINE_TREE_SCHEMA_VERSION,
        createdAt: data.tree.created_at,
        updatedAt: data.tree.updated_at,
        publishedRevision: 1,
        people: data.people.map(p => ({
          id: p.id,
          firstName: p.name.split(" ")[0] || p.name,
          lastName: p.name.split(" ").slice(1).join(" ") || "",
          gender: "unknown",
          birthDate: p.birth_date || "",
          deathDate: p.death_date || "",
          notes: p.notes,
          photoUrl: p.photo_url,
          sortOrder: 0,
          updatedAt: data.tree.updated_at,
        })),
        relationships: data.rels.map(r => ({
          id: r.id,
          type: r.type as "parent-child" | "partner",
          fromPersonId: r.person1_id,
          toPersonId: r.person2_id,
          updatedAt: data.tree.updated_at,
        })),
      });

      return {
        publicId,
        name: data.tree.name,
        schemaVersion: ONLINE_TREE_SCHEMA_VERSION,
        publishedRevision: 1,
        publishedAt: data.tree.created_at,
        tree,
      };
    } catch {
      return null;
    }
  }
}
