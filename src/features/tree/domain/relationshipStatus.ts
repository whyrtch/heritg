import type { FamilyTree, Gender, ParentKind, PartnerStatus, Relationship, RelationshipDetails } from "../model";

/**
 * The relationship statuses offered by the add-relative wizard (heritg.us step 2), expressed in terms of
 * the v2 model: where the new person sits relative to the anchor, the parent kind or partner status, and
 * the gender the status implies for the new person.
 */
export type RelationshipStatusKey =
  | "father" | "mother" | "son" | "daughter" | "wife" | "husband"
  | "stepFather" | "stepMother" | "adoptiveFather" | "adoptiveMother" | "fosterFather" | "fosterMother" | "guardian"
  | "partner" | "exPartner" | "exHusband" | "exWife"
  | "stepSon" | "stepDaughter" | "adoptiveSon" | "adoptiveDaughter" | "fosterSon" | "fosterDaughter" | "ward";

export type StatusGroup = "common" | "parents" | "partners" | "children";
export type StatusDirection = "parent" | "child" | "partner";

export type RelationshipStatus = {
  key: RelationshipStatusKey;
  group: StatusGroup;
  /** Role of the NEW person relative to the anchor person. */
  direction: StatusDirection;
  gender: Gender;
  kind?: ParentKind;
  status?: PartnerStatus;
};

const s = (key: RelationshipStatusKey, group: StatusGroup, direction: StatusDirection, gender: Gender, detail: { kind?: ParentKind; status?: PartnerStatus }): RelationshipStatus => ({ key, group, direction, gender, ...detail });

export const RELATIONSHIP_STATUSES: readonly RelationshipStatus[] = [
  s("father", "common", "parent", "male", { kind: "biological" }),
  s("mother", "common", "parent", "female", { kind: "biological" }),
  s("son", "common", "child", "male", { kind: "biological" }),
  s("daughter", "common", "child", "female", { kind: "biological" }),
  s("wife", "common", "partner", "female", { status: "married" }),
  s("husband", "common", "partner", "male", { status: "married" }),
  s("stepFather", "parents", "parent", "male", { kind: "step" }),
  s("stepMother", "parents", "parent", "female", { kind: "step" }),
  s("adoptiveFather", "parents", "parent", "male", { kind: "adoptive" }),
  s("adoptiveMother", "parents", "parent", "female", { kind: "adoptive" }),
  s("fosterFather", "parents", "parent", "male", { kind: "foster" }),
  s("fosterMother", "parents", "parent", "female", { kind: "foster" }),
  s("guardian", "parents", "parent", "unspecified", { kind: "guardian" }),
  s("partner", "partners", "partner", "unspecified", { status: "partner" }),
  s("exPartner", "partners", "partner", "unspecified", { status: "ex" }),
  s("exHusband", "partners", "partner", "male", { status: "ex" }),
  s("exWife", "partners", "partner", "female", { status: "ex" }),
  s("stepSon", "children", "child", "male", { kind: "step" }),
  s("stepDaughter", "children", "child", "female", { kind: "step" }),
  s("adoptiveSon", "children", "child", "male", { kind: "adoptive" }),
  s("adoptiveDaughter", "children", "child", "female", { kind: "adoptive" }),
  s("fosterSon", "children", "child", "male", { kind: "foster" }),
  s("fosterDaughter", "children", "child", "female", { kind: "foster" }),
  s("ward", "children", "child", "unspecified", { kind: "guardian" }),
];

export const STATUS_GROUPS: readonly StatusGroup[] = ["common", "parents", "partners", "children"];

export function statusByKey(key: RelationshipStatusKey): RelationshipStatus {
  const status = RELATIONSHIP_STATUSES.find(item => item.key === key);
  if (!status) throw new Error(`Unknown relationship status ${key}.`);
  return status;
}

/** Turn a wizard choice into the relationship to create between the anchor and the new person. */
export function statusToRelationship(key: RelationshipStatusKey, anchorId: string, newPersonId: string, marriedOn = ""): { type: Relationship["type"]; from: string; to: string; details: RelationshipDetails; gender: Gender } {
  const status = statusByKey(key);
  if (status.direction === "partner") return { type: "partner", from: anchorId, to: newPersonId, details: { status: status.status, marriedOn }, gender: status.gender };
  const [from, to] = status.direction === "parent" ? [newPersonId, anchorId] : [anchorId, newPersonId];
  return { type: "parent-child", from, to, details: { kind: status.kind }, gender: status.gender };
}

/**
 * Describe an existing relationship from the anchor's point of view as a wizard status, using the other
 * person's gender (e.g. a step parent-child edge whose parent is female, seen from the child = "stepMother").
 */
export function relationshipToStatus(tree: Pick<FamilyTree, "people">, relationship: Relationship, anchorId: string): RelationshipStatusKey | null {
  if (relationship.from !== anchorId && relationship.to !== anchorId) return null;
  const otherId = relationship.from === anchorId ? relationship.to : relationship.from;
  const gender = tree.people.find(person => person.id === otherId)?.gender ?? "unspecified";
  const direction: StatusDirection = relationship.type === "partner" ? "partner" : relationship.to === anchorId ? "parent" : "child";
  const candidates = RELATIONSHIP_STATUSES.filter(item => item.direction === direction && (direction === "partner" ? item.status === relationship.status : item.kind === relationship.kind));
  return (candidates.find(item => item.gender === gender) ?? candidates.find(item => item.gender === "unspecified") ?? candidates[0])?.key ?? null;
}
