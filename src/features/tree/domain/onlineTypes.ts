import type { Gender, ParentKind, PartnerStatus, Relationship } from "../model";

/** v2: single `name`, birth order, residence, relationship kind/status. v1 documents are still readable. */
export const ONLINE_TREE_SCHEMA_VERSION = 2;
export const READABLE_SCHEMA_VERSIONS = [1, 2] as const;
export type TreeVisibility = "private" | "unlisted";

export type OnlinePerson = {
  id: string;
  name: string;
  gender: Gender;
  birthDate: string;
  deathDate: string;
  birthOrder: number | null;
  residence: string;
  notes: string;
  photoUrl: string;
  sortOrder: number;
  updatedAt: string;
};

export type OnlineRelationship = {
  id: string;
  type: Relationship["type"];
  fromPersonId: string;
  toPersonId: string;
  kind: ParentKind | null;
  status: PartnerStatus | null;
  marriedOn: string;
  updatedAt: string;
};

export type OnlineTree = {
  id: string;
  ownerId: string;
  name: string;
  visibility: TreeVisibility;
  publicId: string | null;
  revision: number;
  schemaVersion: number;
  createdAt: string;
  updatedAt: string;
  publishedRevision: number | null;
  people: OnlinePerson[];
  relationships: OnlineRelationship[];
};

export type TreeMember = {
  uid: string;
  role: "owner" | "editor" | "viewer";
  invitedAt: string | null;
  acceptedAt: string | null;
};
