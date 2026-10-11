export type Gender = "female" | "male" | "nonbinary" | "unspecified";
export type Person = {
  id: string; firstName: string; lastName: string; gender: Gender;
  birthDate: string; deathDate: string; notes: string; photoUrl: string;
  /** @deprecated Legacy MVP data-URL field. Kept readable until migration completes. */
  photo?: string;
};
export type Relationship = { id: string; type: "parent-child" | "partner"; from: string; to: string };
export type FamilyTree = { id: string; name: string; people: Person[]; relationships: Relationship[]; updatedAt: string };
export type WorkspaceData = { version: 1; activeTreeId: string; trees: FamilyTree[] };

export const uid = () => crypto.randomUUID();
export const emptyPerson = (): Person => ({ id: uid(), firstName: "", lastName: "", gender: "unspecified", birthDate: "", deathDate: "", notes: "", photoUrl: "", photo: "" });
export const newTree = (name = "My Family Tree"): FamilyTree => ({ id: uid(), name, people: [], relationships: [], updatedAt: new Date().toISOString() });
export const initialData = (): WorkspaceData => { const tree = newTree(); return { version: 1, activeTreeId: tree.id, trees: [tree] }; };

export function displayName(person: Person) { return `${person.firstName} ${person.lastName}`.trim() || "Unnamed person"; }

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

export function addRelationship(tree: FamilyTree, type: Relationship["type"], from: string, to: string): FamilyTree {
  if (from === to) throw new Error("A person cannot be related to themselves.");
  const duplicate = tree.relationships.some(r => r.type === type && ((r.from === from && r.to === to) || (type === "partner" && r.from === to && r.to === from)));
  if (duplicate) throw new Error("This relationship already exists.");
  if (type === "parent-child" && ancestors(tree, from).has(to)) throw new Error("This relationship would create a family cycle.");
  return { ...tree, relationships: [...tree.relationships, { id: uid(), type, from, to }], updatedAt: new Date().toISOString() };
}

export function removePerson(tree: FamilyTree, id: string): FamilyTree {
  return { ...tree, people: tree.people.filter(p => p.id !== id), relationships: tree.relationships.filter(r => r.from !== id && r.to !== id), updatedAt: new Date().toISOString() };
}

export function exportTree(tree: FamilyTree) { return JSON.stringify({ version: 1, tree }, null, 2); }
export function importTree(raw: string): FamilyTree {
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== "object" || !("version" in value) || !("tree" in value)) throw new Error("Not a valid .heritg file.");
  const envelope = value as { version: unknown; tree: unknown };
  if (envelope.version !== 1 || !envelope.tree || typeof envelope.tree !== "object") throw new Error("Unsupported .heritg file version.");
  const tree = envelope.tree as Partial<FamilyTree>;
  if (typeof tree.id !== "string" || typeof tree.name !== "string" || !Array.isArray(tree.people) || !Array.isArray(tree.relationships)) throw new Error("The family tree file is incomplete.");
  const ids = new Set(tree.people.map(p => p?.id));
  if (ids.size !== tree.people.length || tree.relationships.some(r => !r || !ids.has(r.from) || !ids.has(r.to))) throw new Error("The family tree contains broken relationships.");
  const people = tree.people.map(person => ({
    ...person,
    photoUrl: typeof person.photoUrl === "string" ? person.photoUrl : "",
    photo: typeof person.photo === "string" ? person.photo : "",
  }));
  return { ...tree, people, id: uid(), name: `${tree.name} (Imported)`, updatedAt: new Date().toISOString() } as FamilyTree;
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
