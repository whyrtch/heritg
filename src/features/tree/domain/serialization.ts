import { normalizePerson, normalizeRelationship, type FamilyTree, type Relationship } from "../model";
import { isLegacyDataUrlPhoto, validatePhotoUrl } from "./photoUrl";
import {
  ONLINE_TREE_SCHEMA_VERSION,
  READABLE_SCHEMA_VERSIONS,
  type OnlinePerson,
  type OnlineRelationship,
  type OnlineTree,
  type TreeVisibility,
} from "./onlineTypes";

export type OnlineTreeOptions = {
  ownerId?: string;
  visibility?: TreeVisibility;
  publicId?: string | null;
  revision?: number;
  createdAt?: string;
  publishedRevision?: number | null;
};

export type SerializedOnlineTree = OnlineTree & { excludedDataUrlPhotoIds: string[] };

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${field} must be a non-empty string.`);
  return value;
}

function stringValue(value: unknown, field: string): string {
  if (typeof value !== "string") throw new Error(`${field} must be a string.`);
  return value;
}

function nullableString(value: unknown, field: string): string | null {
  if (value === null) return null;
  return stringValue(value, field);
}

function nonNegativeInteger(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) throw new Error(`${field} must be a non-negative safe integer.`);
  return value as number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function relationshipType(value: unknown): Relationship["type"] {
  if (value === "parent-child" || value === "partner") return value;
  throw new Error("relationship type is unsupported.");
}

function resolvePhoto(person: FamilyTree["people"][number]): { photoUrl: string; excluded: boolean } {
  const preferred = person.photoUrl?.trim() ?? "";
  const legacy = person.photo?.trim() ?? "";
  const candidate = preferred || legacy;
  if (!candidate) return { photoUrl: "", excluded: false };
  if (isLegacyDataUrlPhoto(candidate)) return { photoUrl: "", excluded: true };
  const validation = validatePhotoUrl(candidate);
  if (!validation.ok) throw new Error(`Invalid photo URL for person ${person.id}: ${validation.error}`);
  return { photoUrl: candidate, excluded: false };
}

export function toOnlineTree(localTree: FamilyTree, options: OnlineTreeOptions = {}): SerializedOnlineTree {
  const updatedAt = requiredString(localTree.updatedAt, "updatedAt");
  const excludedDataUrlPhotoIds: string[] = [];
  const people: OnlinePerson[] = localTree.people.map((person, sortOrder) => {
    const photo = resolvePhoto(person);
    if (photo.excluded) excludedDataUrlPhotoIds.push(person.id);
    return {
      id: requiredString(person.id, "person.id"),
      name: stringValue(person.name, "person.name"),
      gender: person.gender,
      birthDate: stringValue(person.birthDate, "person.birthDate"),
      deathDate: stringValue(person.deathDate, "person.deathDate"),
      birthOrder: person.birthOrder,
      residence: stringValue(person.residence, "person.residence"),
      notes: stringValue(person.notes, "person.notes"),
      photoUrl: photo.photoUrl,
      sortOrder,
      updatedAt,
    };
  });
  const personIds = new Set(people.map(person => person.id));
  if (personIds.size !== people.length) throw new Error("Person IDs must be unique.");

  const relationships: OnlineRelationship[] = localTree.relationships.map(relationship => {
    if (!personIds.has(relationship.from) || !personIds.has(relationship.to)) throw new Error(`Relationship ${relationship.id} references an unknown person.`);
    return {
      id: requiredString(relationship.id, "relationship.id"),
      type: relationshipType(relationship.type),
      fromPersonId: relationship.from,
      toPersonId: relationship.to,
      kind: relationship.type === "parent-child" ? relationship.kind ?? "biological" : null,
      status: relationship.type === "partner" ? relationship.status ?? "married" : null,
      marriedOn: relationship.type === "partner" ? relationship.marriedOn ?? "" : "",
      updatedAt,
    };
  });
  if (new Set(relationships.map(relationship => relationship.id)).size !== relationships.length) throw new Error("Relationship IDs must be unique.");

  return {
    id: requiredString(localTree.id, "tree.id"),
    ownerId: options.ownerId ?? "",
    name: requiredString(localTree.name, "tree.name"),
    visibility: options.visibility ?? "private",
    publicId: options.publicId ?? null,
    revision: nonNegativeInteger(options.revision ?? 0, "revision"),
    schemaVersion: ONLINE_TREE_SCHEMA_VERSION,
    createdAt: options.createdAt ?? updatedAt,
    updatedAt,
    publishedRevision: options.publishedRevision ?? null,
    people,
    relationships,
    excludedDataUrlPhotoIds,
  };
}

export function fromOnlineTree(value: unknown): FamilyTree {
  if (!isRecord(value)) throw new Error("Online tree must be an object.");
  if (!(READABLE_SCHEMA_VERSIONS as readonly number[]).includes(nonNegativeInteger(value.schemaVersion, "schemaVersion"))) throw new Error("Unsupported online tree schema version.");
  requiredString(value.ownerId, "ownerId");
  if (value.visibility !== "private" && value.visibility !== "unlisted") throw new Error("visibility is unsupported.");
  nullableString(value.publicId, "publicId");
  nonNegativeInteger(value.revision, "revision");
  if (value.publishedRevision !== null) nonNegativeInteger(value.publishedRevision, "publishedRevision");
  requiredString(value.createdAt, "createdAt");
  const updatedAt = requiredString(value.updatedAt, "updatedAt");
  if (!Array.isArray(value.people) || !Array.isArray(value.relationships)) throw new Error("Online tree collections are incomplete.");

  const peopleWithOrder = value.people.map((item): { person: FamilyTree["people"][number]; sortOrder: number } => {
    if (!isRecord(item)) throw new Error("Online person must be an object.");
    const photoUrl = stringValue(item.photoUrl, "person.photoUrl");
    const validation = validatePhotoUrl(photoUrl);
    if (!validation.ok) throw new Error(validation.error);
    const sortOrder = nonNegativeInteger(item.sortOrder, "person.sortOrder");
    requiredString(item.updatedAt, "person.updatedAt");
    requiredString(item.id, "person.id");
    // normalizePerson reads both v1 (firstName/lastName) and v2 (name) documents.
    return { person: { ...normalizePerson(item), photoUrl }, sortOrder };
  });
  const people = peopleWithOrder.sort((a, b) => a.sortOrder - b.sortOrder).map(item => item.person);
  const personIds = new Set(people.map(person => person.id));
  if (personIds.size !== people.length) throw new Error("Person IDs must be unique.");

  const relationships = value.relationships.map((item): Relationship => {
    if (!isRecord(item)) throw new Error("Online relationship must be an object.");
    const from = requiredString(item.fromPersonId, "relationship.fromPersonId");
    const to = requiredString(item.toPersonId, "relationship.toPersonId");
    if (!personIds.has(from) || !personIds.has(to)) throw new Error("Online relationship references an unknown person.");
    requiredString(item.updatedAt, "relationship.updatedAt");
    relationshipType(item.type);
    return normalizeRelationship({ ...item, id: requiredString(item.id, "relationship.id"), from, to });
  });
  if (new Set(relationships.map(relationship => relationship.id)).size !== relationships.length) throw new Error("Relationship IDs must be unique.");

  return { id: requiredString(value.id, "tree.id"), name: requiredString(value.name, "tree.name"), people, relationships, updatedAt };
}

/**
 * Upgrade a cached online tree (possibly schema v1) to the v2 document shape without validating it, so
 * locally cached trees and pending offline edits survive the schema change. Already-v2 trees pass through.
 */
export function upgradeOnlineTree<T extends OnlineTree>(tree: T): T {
  if (tree.schemaVersion === ONLINE_TREE_SCHEMA_VERSION) return tree;
  return {
    ...tree,
    schemaVersion: ONLINE_TREE_SCHEMA_VERSION,
    people: tree.people.map(item => {
      const person = normalizePerson(item as unknown as Record<string, unknown>);
      return { id: item.id, name: person.name, gender: person.gender, birthDate: person.birthDate, deathDate: person.deathDate, birthOrder: person.birthOrder, residence: person.residence, notes: person.notes, photoUrl: person.photoUrl, sortOrder: item.sortOrder, updatedAt: item.updatedAt };
    }),
    relationships: tree.relationships.map(item => {
      const relationship = normalizeRelationship({ ...(item as unknown as Record<string, unknown>), from: item.fromPersonId, to: item.toPersonId });
      return { id: item.id, type: relationship.type, fromPersonId: item.fromPersonId, toPersonId: item.toPersonId, kind: relationship.kind, status: relationship.status, marriedOn: relationship.marriedOn, updatedAt: item.updatedAt };
    }),
  };
}
