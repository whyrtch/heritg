import type { Gender, Relationship } from "../model";

export const ONLINE_TREE_SCHEMA_VERSION = 1;
export type TreeVisibility = "private" | "unlisted";

export type OnlinePerson = {
  id: string;
  firstName: string;
  lastName: string;
  gender: Gender;
  birthDate: string;
  deathDate: string;
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
