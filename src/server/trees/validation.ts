import "server-only";
import { z } from "zod";

/**
 * Request bodies for the trees API. Limits mirror the domain (src/features/tree/model.ts) and the
 * database CHECKs, so invalid data is rejected with a 400 before it reaches PostgreSQL.
 * Ownership, timestamps, revision and publication fields are always decided by the server.
 */
export const ID = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/, "Invalid id.");
// PostgreSQL text cannot hold U+0000; reject it here so it is a 400, not a database error.
const NO_NUL = (value: string) => !value.includes("\u0000");
const ISO_DATE_OR_EMPTY = z.string().regex(/^([0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01]))?$/, "Use YYYY-MM-DD.");
// Explicit whitespace class (incl. U+0085) so JS agrees with PostgreSQL's [^[:space:]] CHECK.
const HTTPS_OR_EMPTY = z.string().max(2048).regex(/^(https:\/\/[^\s\u0085]+)?$/, "Photo links must use HTTPS.");
const TEXT = (min: number, max: number) => z.string()
  .refine(value => [...value].length >= min && [...value].length <= max, `Use ${min}–${max} characters.`)
  .refine(NO_NUL, "Text cannot contain NUL characters.");

export const MAX_PEOPLE = 5000, MAX_RELATIONSHIPS = 20000;

const person = z.object({
  id: ID,
  name: TEXT(1, 120),
  gender: z.enum(["female", "male", "unspecified"]),
  birthDate: ISO_DATE_OR_EMPTY,
  deathDate: ISO_DATE_OR_EMPTY,
  birthOrder: z.number().int().min(1).max(99).nullable(),
  residence: TEXT(0, 120),
  notes: TEXT(0, 10000),
  photoUrl: HTTPS_OR_EMPTY,
  sortOrder: z.number().int().min(0).max(1_000_000),
});

const relationship = z.discriminatedUnion("type", [
  z.object({ id: ID, type: z.literal("parent-child"), fromPersonId: ID, toPersonId: ID, kind: z.enum(["biological", "step", "adoptive", "foster", "guardian"]), status: z.null(), marriedOn: z.literal("") }),
  z.object({ id: ID, type: z.literal("partner"), fromPersonId: ID, toPersonId: ID, kind: z.null(), status: z.enum(["married", "partner", "ex"]), marriedOn: ISO_DATE_OR_EMPTY }),
]);

export const treeInput = z.object({
  id: ID,
  name: TEXT(1, 120),
  schemaVersion: z.literal(2),
  people: z.array(person).max(MAX_PEOPLE),
  relationships: z.array(relationship).max(MAX_RELATIONSHIPS),
}).superRefine((tree, context) => {
  const ids = new Set<string>();
  tree.people.forEach((item, index) => { if (ids.has(item.id)) context.addIssue({ code: "custom", path: ["people", index, "id"], message: "Duplicate person id." }); ids.add(item.id); });
  const relationshipIds = new Set<string>();
  tree.relationships.forEach((item, index) => {
    if (relationshipIds.has(item.id)) context.addIssue({ code: "custom", path: ["relationships", index, "id"], message: "Duplicate relationship id." });
    relationshipIds.add(item.id);
    if (item.fromPersonId === item.toPersonId) context.addIssue({ code: "custom", path: ["relationships", index], message: "A person cannot be related to themselves." });
    if (!ids.has(item.fromPersonId) || !ids.has(item.toPersonId)) context.addIssue({ code: "custom", path: ["relationships", index], message: "Relationships must connect people in the same tree." });
  });
});

export type TreeInput = z.infer<typeof treeInput>;

export const createBody = z.object({ tree: treeInput });
export const saveBody = z.object({ tree: treeInput, expectedRevision: z.number().int().min(0) });
