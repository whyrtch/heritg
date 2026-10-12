export type Gender = "female" | "male" | "unspecified";
export type Person = {
  id: string; name: string; gender: Gender;
  birthDate: string; deathDate: string;
  /** 1 = first child, 2 = second… null = unknown (ordering then follows birth dates). */
  birthOrder: number | null;
  residence: string; notes: string; photoUrl: string;
  /** @deprecated Legacy MVP data-URL field. Kept readable until migration completes. */
  photo?: string;
};
export type ParentKind = "biological" | "step" | "adoptive" | "foster" | "guardian";
export type PartnerStatus = "married" | "partner" | "ex";
/** parent-child uses `kind` (status null, marriedOn ""); partner uses `status` + `marriedOn` (kind null). */
export type Relationship = { id: string; type: "parent-child" | "partner"; from: string; to: string; kind: ParentKind | null; status: PartnerStatus | null; marriedOn: string };
export type FamilyTree = { id: string; name: string; people: Person[]; relationships: Relationship[]; updatedAt: string };
export type WorkspaceData = { version: 1; activeTreeId: string; trees: FamilyTree[] };

export const PARENT_KINDS: readonly ParentKind[] = ["biological", "step", "adoptive", "foster", "guardian"];
export const PARTNER_STATUSES: readonly PartnerStatus[] = ["married", "partner", "ex"];

export const uid = () => crypto.randomUUID();
export const emptyPerson = (): Person => ({ id: uid(), name: "", gender: "unspecified", birthDate: "", deathDate: "", birthOrder: null, residence: "", notes: "", photoUrl: "", photo: "" });
export const newTree = (name = "Silsilah Keluarga Saya"): FamilyTree => ({ id: uid(), name, people: [], relationships: [], updatedAt: new Date().toISOString() });
/** An independent copy with fresh person and relationship ids; relationships are remapped to the new person ids. */
export function duplicateTree(tree: FamilyTree, name: string): FamilyTree {
  const ids = new Map(tree.people.map(person => [person.id, uid()]));
  return {
    id: uid(), name: name.slice(0, NAME_MAX), // the server rejects longer tree names
    people: tree.people.map(person => ({ ...person, id: ids.get(person.id)! })),
    relationships: tree.relationships.map(rel => ({ ...rel, id: uid(), from: ids.get(rel.from) ?? rel.from, to: ids.get(rel.to) ?? rel.to })),
    updatedAt: new Date().toISOString(),
  };
}
export const initialData = (): WorkspaceData => { const tree = newTree(); return { version: 1, activeTreeId: tree.id, trees: [tree] }; };

export const UNNAMED = "Tanpa nama";
export function displayName(person: Pick<Person, "name">) { return person.name.trim() || UNNAMED; }
/** Limits shared with the server: src/server/trees/validation.ts and the CHECKs in src/server/db/schema.ts. */
export const NAME_MAX = 120, RESIDENCE_MAX = 120, BIRTH_ORDER_MAX = 99;
const ISO_DATE = /^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/;

// ---- Schema v1 → v2 upgrade (pure; safe to run on data that is already v2) ----
const str = (value: unknown) => (typeof value === "string" ? value : "");
/** Accepts a v1 person (firstName/lastName, nonbinary gender) or a v2 person and returns a v2 person. */
export function normalizePerson(raw: Record<string, unknown>): Person {
  // v1 allowed 120 + 120 characters; the joined v2 name must stay within the Rules limit and never be empty.
  const name = (typeof raw.name === "string" ? raw.name : `${str(raw.firstName)} ${str(raw.lastName)}`).trim().slice(0, NAME_MAX).trim() || UNNAMED;
  const gender: Gender = raw.gender === "male" || raw.gender === "female" ? raw.gender : "unspecified";
  const birthOrder = Number.isSafeInteger(raw.birthOrder) && (raw.birthOrder as number) >= 1 && (raw.birthOrder as number) <= BIRTH_ORDER_MAX ? raw.birthOrder as number : null;
  return { id: str(raw.id), name, gender, birthDate: str(raw.birthDate), deathDate: str(raw.deathDate), birthOrder, residence: str(raw.residence).slice(0, RESIDENCE_MAX), notes: str(raw.notes), photoUrl: str(raw.photoUrl), photo: str(raw.photo) };
}
/** Accepts a v1 relationship ({id,type,from,to}) or a v2 one and fills the v2 defaults (biological / married). */
export function normalizeRelationship(raw: Record<string, unknown>): Relationship {
  const type = raw.type === "partner" ? "partner" : "parent-child";
  if (type === "partner") {
    const status = PARTNER_STATUSES.includes(raw.status as PartnerStatus) ? raw.status as PartnerStatus : "married";
    const marriedOn = ISO_DATE.test(str(raw.marriedOn)) ? str(raw.marriedOn) : "";
    return { id: str(raw.id), type, from: str(raw.from), to: str(raw.to), kind: null, status, marriedOn };
  }
  const kind = PARENT_KINDS.includes(raw.kind as ParentKind) ? raw.kind as ParentKind : "biological";
  return { id: str(raw.id), type, from: str(raw.from), to: str(raw.to), kind, status: null, marriedOn: "" };
}
export function normalizeTree(tree: FamilyTree): FamilyTree {
  return { ...tree, people: tree.people.map(person => normalizePerson(person as unknown as Record<string, unknown>)), relationships: tree.relationships.map(relationship => normalizeRelationship(relationship as unknown as Record<string, unknown>)) };
}
export function normalizeWorkspace(workspace: WorkspaceData): WorkspaceData {
  return { ...workspace, trees: workspace.trees.map(normalizeTree) };
}

const year = (iso: string) => iso.slice(0, 4);
export function lifespanLabel(person: Person): string {
  const born = year(person.birthDate), died = year(person.deathDate);
  if (born && died) return `${born} – ${died}`;
  if (born) return `Born ${born}`;
  if (died) return `Died ${died}`;
  return "Years unknown";
}

const longDate = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const formatLongDate = (iso: string) => longDate.format(new Date(`${iso}T00:00:00Z`));
export function lifeDatesLong(person: Person): string {
  const parts = [person.birthDate && `Born ${formatLongDate(person.birthDate)}`, person.deathDate && `Died ${formatLongDate(person.deathDate)}`].filter(Boolean);
  return parts.length ? parts.join(" · ") : "Birth date unknown";
}
export function parentsOf(tree: FamilyTree, id: string) { return tree.relationships.filter(r => r.type === "parent-child" && r.to === id).map(r => r.from); }
export function childrenOf(tree: FamilyTree, id: string) { return tree.relationships.filter(r => r.type === "parent-child" && r.from === id).map(r => r.to); }

function ancestors(tree: FamilyTree, id: string, seen = new Set<string>()): Set<string> {
  for (const parent of parentsOf(tree, id)) if (!seen.has(parent)) { seen.add(parent); ancestors(tree, parent, seen); }
  return seen;
}

export type RelationshipDetails = { kind?: ParentKind; status?: PartnerStatus; marriedOn?: string };
export function makeRelationship(type: Relationship["type"], from: string, to: string, details: RelationshipDetails = {}): Relationship {
  return type === "partner"
    ? { id: uid(), type, from, to, kind: null, status: details.status ?? "married", marriedOn: details.marriedOn ?? "" }
    : { id: uid(), type, from, to, kind: details.kind ?? "biological", status: null, marriedOn: "" };
}

export function addRelationship(tree: FamilyTree, type: Relationship["type"], from: string, to: string, details: RelationshipDetails = {}): FamilyTree {
  if (from === to) throw new Error("A person cannot be related to themselves.");
  const duplicate = tree.relationships.some(r => r.type === type && ((r.from === from && r.to === to) || (type === "partner" && r.from === to && r.to === from)));
  if (duplicate) throw new Error("This relationship already exists.");
  if (type === "parent-child" && ancestors(tree, from).has(to)) throw new Error("This relationship would create a family cycle.");
  return { ...tree, relationships: [...tree.relationships, makeRelationship(type, from, to, details)], updatedAt: new Date().toISOString() };
}

export function removePerson(tree: FamilyTree, id: string): FamilyTree {
  return { ...tree, people: tree.people.filter(p => p.id !== id), relationships: tree.relationships.filter(r => r.from !== id && r.to !== id), updatedAt: new Date().toISOString() };
}

export function exportTree(tree: FamilyTree) { return JSON.stringify({ version: 2, tree }, null, 2); }
export function importTree(raw: string): FamilyTree {
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== "object" || !("version" in value) || !("tree" in value)) throw new Error("Not a valid .heritg file.");
  const envelope = value as { version: unknown; tree: unknown };
  if ((envelope.version !== 1 && envelope.version !== 2) || !envelope.tree || typeof envelope.tree !== "object") throw new Error("Unsupported .heritg file version.");
  const tree = envelope.tree as Partial<FamilyTree>;
  if (typeof tree.id !== "string" || typeof tree.name !== "string" || !Array.isArray(tree.people) || !Array.isArray(tree.relationships)) throw new Error("The family tree file is incomplete.");
  const ids = new Set(tree.people.map(p => p?.id));
  if (ids.size !== tree.people.length || tree.relationships.some(r => !r || !ids.has(r.from) || !ids.has(r.to))) throw new Error("The family tree contains broken relationships.");
  if (tree.relationships.some(r => r.type !== "parent-child" && r.type !== "partner")) throw new Error("The family tree contains an unknown relationship type.");
  const people = tree.people.map(person => normalizePerson(person as unknown as Record<string, unknown>));
  const relationships = tree.relationships.map(relationship => normalizeRelationship(relationship as unknown as Record<string, unknown>));
  // Server photo paths belong to the account that exported the file; keep only embedded images and links.
  const portable = people.map(person => person.photo?.startsWith("/api/") ? { ...person, photo: "" } : person);
  return { id: uid(), name: `${tree.name} (Impor)`, people: portable, relationships, updatedAt: new Date().toISOString() };
}

export type NodeLayout = { id: string; x: number; y: number };
/** Person card size on the canvas; layoutTree() spacing and connector anchors depend on it. */
export const CARD_W = 210, CARD_H = 108;
export function layoutTree(tree: FamilyTree): NodeLayout[] {
  if (!tree.people.length) return [];
  const levels = new Map<string, number>();
  tree.people.forEach(p => levels.set(p.id, 0));
  for (let pass = 0; pass < tree.people.length; pass += 1) {
    tree.relationships.filter(r => r.type === "partner").forEach(r => { const level = Math.max(levels.get(r.from) ?? 0, levels.get(r.to) ?? 0); levels.set(r.from, level); levels.set(r.to, level); });
    tree.relationships.filter(r => r.type === "parent-child").forEach(r => levels.set(r.to, Math.max(levels.get(r.to) ?? 0, (levels.get(r.from) ?? 0) + 1)));
  }
  const rows = new Map<number, string[]>();
  tree.people.forEach(p => { const level = levels.get(p.id)!; rows.set(level, [...(rows.get(level) ?? []), p.id]); });
  const nodes: NodeLayout[] = [];
  [...rows].sort(([a], [b]) => a - b).forEach(([level, ids]) => ids.forEach((id, index) => nodes.push({ id, x: (index - (ids.length - 1) / 2) * 250, y: level * 190 })));
  return nodes;
}

export function generationCount(tree: FamilyTree): number {
  return new Set(layoutTree(tree).map(node => node.y)).size;
}

export function connectorPath(from: NodeLayout, to: NodeLayout, type: Relationship["type"], radius = 12): string {
  if (type === "partner") {
    const [left, right] = from.x <= to.x ? [from, to] : [to, from];
    return `M ${left.x + CARD_W} ${left.y + CARD_H / 2} L ${right.x} ${right.y + CARD_H / 2}`;
  }
  const x1 = from.x + CARD_W / 2, top = from.y + CARD_H, x2 = to.x + CARD_W / 2, bottom = to.y;
  if (Math.abs(x1 - x2) < 1) return `M ${x1} ${top} V ${bottom}`;
  const mid = (top + bottom) / 2, s = x2 > x1 ? 1 : -1;
  const r = Math.min(radius, Math.abs(x2 - x1) / 2, (bottom - top) / 2);
  return `M ${x1} ${top} V ${mid - r} Q ${x1} ${mid} ${x1 + s * r} ${mid} H ${x2 - s * r} Q ${x2} ${mid} ${x2} ${mid + r} V ${bottom}`;
}

export type Relatives = { parents: Person[]; partners: Person[]; children: Person[] };
export function relativesOf(tree: FamilyTree, id: string): Relatives {
  const byId = new Map(tree.people.map(person => [person.id, person]));
  const pick = (ids: string[]) => ids.map(personId => byId.get(personId)).filter((person): person is Person => Boolean(person));
  const partners = tree.relationships.filter(r => r.type === "partner" && (r.from === id || r.to === id)).map(r => r.from === id ? r.to : r.from);
  return { parents: pick(parentsOf(tree, id)), partners: pick(partners), children: pick(childrenOf(tree, id)) };
}
