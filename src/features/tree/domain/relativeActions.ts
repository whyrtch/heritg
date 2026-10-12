import { addRelationship, type FamilyTree, type Person, type Relationship } from "../model";
import { relationshipToStatus, statusByKey, statusToRelationship, type RelationshipStatusKey } from "./relationshipStatus";

export type AddRelativeInput = {
  status: RelationshipStatusKey;
  /** A new person to create… */
  person?: Person;
  /** …or an existing person to connect. */
  existingId?: string;
  marriedOn?: string;
  /** For child statuses: the anchor's partner who is the other parent. */
  coParentId?: string | null;
};

/** Add a relative to `anchorId` using a wizard status; a new person takes the gender the status implies. */
export function addRelative(tree: FamilyTree, anchorId: string, input: AddRelativeInput): { tree: FamilyTree; personId: string } {
  const status = statusByKey(input.status);
  let next = tree;
  let personId: string;
  if (input.person) {
    const person = { ...input.person, gender: input.person.gender === "unspecified" ? status.gender : input.person.gender };
    personId = person.id;
    next = { ...next, people: [...next.people, person] };
  } else if (input.existingId && tree.people.some(person => person.id === input.existingId)) {
    personId = input.existingId;
  } else throw new Error("Choose who to add.");
  const plan = statusToRelationship(input.status, anchorId, personId, input.marriedOn ?? "");
  next = addRelationship(next, plan.type, plan.from, plan.to, plan.details);
  if (status.direction === "child" && input.coParentId && input.coParentId !== anchorId) next = addRelationship(next, "parent-child", input.coParentId, personId, plan.details);
  return { tree: next, personId };
}

/** Change what an existing relationship means, seen from `anchorId` (e.g. "Istri" → "Mantan istri", "Ayah" → "Ayah tiri"). */
export function setRelationshipStatus(tree: FamilyTree, relationshipId: string, anchorId: string, key: RelationshipStatusKey, marriedOn = ""): FamilyTree {
  const current = tree.relationships.find(relationship => relationship.id === relationshipId);
  if (!current) throw new Error("This relationship no longer exists.");
  const otherId = current.from === anchorId ? current.to : current.from;
  const plan = statusToRelationship(key, anchorId, otherId, marriedOn);
  // Re-validate (duplicates, cycles) against the tree without the edge being replaced, then keep its id.
  const without = { ...tree, relationships: tree.relationships.filter(relationship => relationship.id !== relationshipId) };
  const added = addRelationship(without, plan.type, plan.from, plan.to, plan.details);
  const replacement = { ...added.relationships[added.relationships.length - 1], id: relationshipId };
  return { ...added, relationships: tree.relationships.map(relationship => relationship.id === relationshipId ? replacement : relationship) };
}

export function setMarriedOn(tree: FamilyTree, relationshipId: string, marriedOn: string): FamilyTree {
  return { ...tree, relationships: tree.relationships.map(relationship => relationship.id === relationshipId && relationship.type === "partner" ? { ...relationship, marriedOn } : relationship), updatedAt: new Date().toISOString() };
}

export function removeRelationship(tree: FamilyTree, relationshipId: string): FamilyTree {
  return { ...tree, relationships: tree.relationships.filter(relationship => relationship.id !== relationshipId), updatedAt: new Date().toISOString() };
}

export type FamilyRow = { relationship: Relationship; person: Person; status: RelationshipStatusKey | null };

/** Everyone directly connected to `anchorId`, with the wizard status that describes them. */
export function familyRows(tree: FamilyTree, anchorId: string): FamilyRow[] {
  const byId = new Map(tree.people.map(person => [person.id, person]));
  return tree.relationships
    .filter(relationship => relationship.from === anchorId || relationship.to === anchorId)
    .map(relationship => ({ relationship, person: byId.get(relationship.from === anchorId ? relationship.to : relationship.from)!, status: relationshipToStatus(tree, relationship, anchorId) }))
    .filter(row => Boolean(row.person));
}

/** People who could be connected to `anchorId`: everyone else without a direct relationship yet. */
export function linkCandidates(tree: FamilyTree, anchorId: string): Person[] {
  const connected = new Set(familyRows(tree, anchorId).map(row => row.person.id));
  return tree.people.filter(person => person.id !== anchorId && !connected.has(person.id));
}

/** The anchor's partners, offered as the other parent when adding a child. */
export function partnersOf(tree: FamilyTree, anchorId: string): Person[] {
  const ids = tree.relationships.filter(r => r.type === "partner" && (r.from === anchorId || r.to === anchorId)).map(r => r.from === anchorId ? r.to : r.from);
  return tree.people.filter(person => ids.includes(person.id));
}
