import type { FamilyTree, Gender, Relationship } from "../model";
import { isLegacyDataUrlPhoto, validatePhotoUrl } from "./photoUrl";
import {
  ONLINE_TREE_SCHEMA_VERSION,
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

function gender(value: unknown): Gender {
  if (value === "female" || value === "male" || value === "nonbinary" || value === "unspecified") return value;
  throw new Error("gender is unsupported.");
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
      firstName: stringValue(person.firstName, "person.firstName"),
      lastName: stringValue(person.lastName, "person.lastName"),
      gender: gender(person.gender),
      birthDate: stringValue(person.birthDate, "person.birthDate"),
      deathDate: stringValue(person.deathDate, "person.deathDate"),
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
  if (nonNegativeInteger(value.schemaVersion, "schemaVersion") !== ONLINE_TREE_SCHEMA_VERSION) throw new Error("Unsupported online tree schema version.");
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
    return { person: {
      id: requiredString(item.id, "person.id"),
      firstName: stringValue(item.firstName, "person.firstName"),
      lastName: stringValue(item.lastName, "person.lastName"),
      gender: gender(item.gender),
      birthDate: stringValue(item.birthDate, "person.birthDate"),
      deathDate: stringValue(item.deathDate, "person.deathDate"),
      notes: stringValue(item.notes, "person.notes"),
      photoUrl,
    }, sortOrder };
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
    return { id: requiredString(item.id, "relationship.id"), type: relationshipType(item.type), from, to };
  });
  if (new Set(relationships.map(relationship => relationship.id)).size !== relationships.length) throw new Error("Relationship IDs must be unique.");

  return { id: requiredString(value.id, "tree.id"), name: requiredString(value.name, "tree.name"), people, relationships, updatedAt };
}
