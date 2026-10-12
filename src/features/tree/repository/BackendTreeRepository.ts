"use client";

import type { OnlineTree } from "../domain/onlineTypes";
import { ONLINE_TREE_SCHEMA_VERSION } from "../domain/onlineTypes";
import { TreeRepositoryError, type TreeRepository } from "./TreeRepository";

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

export class BackendTreeRepository implements TreeRepository {
  async listOwned(uid: string): Promise<OnlineTree[]> {
    const trees = await apiFetch<Array<{
      id: string;
      owner_id: string;
      name: string;
      description: string;
      is_public: boolean;
      created_at: string;
      updated_at: string;
    }>>(`${API_URL}/trees/my`);
    
    return trees.map(t => ({
      id: t.id,
      ownerId: t.owner_id,
      name: t.name,
      visibility: t.is_public ? "unlisted" : "private",
      publicId: null,
      revision: 1,
      schemaVersion: ONLINE_TREE_SCHEMA_VERSION,
      createdAt: t.created_at,
      updatedAt: t.updated_at,
      publishedRevision: null,
      people: [],
      relationships: [],
    }));
  }

  async load(treeId: string): Promise<OnlineTree> {
    const data = await apiFetch<{
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
      people: Array<{
        id: string;
        tree_id: string;
        name: string;
        birth_date: string | null;
        death_date: string | null;
        photo_url: string;
        notes: string;
        birth_place: string | null;
        death_place: string | null;
        occupation: string | null;
        education: string | null;
        created_at: string;
        updated_at: string;
      }>;
      rels: Array<{
        id: string;
        tree_id: string;
        person1_id: string;
        person2_id: string;
        relationship_type: string;
        notes: string;
        created_at: string;
        updated_at: string;
      }>;
    }>(`${API_URL}/trees/${treeId}`);

    return {
      id: data.tree.id,
      ownerId: data.tree.owner_id,
      name: data.tree.name,
      visibility: data.tree.is_public ? "unlisted" : "private",
      publicId: data.tree.public_link_id,
      revision: 1,
      schemaVersion: ONLINE_TREE_SCHEMA_VERSION,
      createdAt: data.tree.created_at,
      updatedAt: data.tree.updated_at,
      publishedRevision: null,
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
        updatedAt: p.updated_at,
      })),
      relationships: data.rels.map(r => ({
        id: r.id,
        type: r.relationship_type as "parent-child" | "partner",
        fromPersonId: r.person1_id,
        toPersonId: r.person2_id,
        updatedAt: r.updated_at,
      })),
    };
  }

  async create(tree: OnlineTree): Promise<OnlineTree> {
    const created = await apiFetch<{
      id: string;
      owner_id: string;
      name: string;
      description: string;
      is_public: boolean;
      created_at: string;
      updated_at: string;
    }>(`${API_URL}/trees`, {
      method: "POST",
      body: JSON.stringify({
        name: tree.name,
        description: tree.description || "",
      }),
    });

    return {
      id: created.id,
      ownerId: created.owner_id,
      name: created.name,
      visibility: "private",
      publicId: null,
      revision: 1,
      schemaVersion: ONLINE_TREE_SCHEMA_VERSION,
      createdAt: created.created_at,
      updatedAt: created.updated_at,
      publishedRevision: null,
      people: [],
      relationships: [],
    };
  }

  async save(tree: OnlineTree, _expectedRevision: number): Promise<OnlineTree> {
    const updated = await apiFetch<{
      id: string;
      owner_id: string;
      name: string;
      description: string;
      is_public: boolean;
      public_link_id: string | null;
      created_at: string;
      updated_at: string;
    }>(`${API_URL}/trees/${tree.id}`, {
      method: "PUT",
      body: JSON.stringify({
        name: tree.name,
        description: tree.description || "",
        is_public: tree.visibility === "unlisted",
      }),
    });

    return {
      ...tree,
      name: updated.name,
      visibility: updated.is_public ? "unlisted" : "private",
      publicId: updated.public_link_id,
      updatedAt: updated.updated_at,
    };
  }

  async delete(treeId: string): Promise<void> {
    await apiFetch(`${API_URL}/trees/${treeId}`, {
      method: "DELETE",
    });
  }
}
