export type Gender = "female" | "male" | "nonbinary" | "unspecified";
export type Person = {
  id: string; firstName: string; lastName: string; gender: Gender;
  birthDate: string; deathDate: string; notes: string; photo: string;
};
export type Relationship = { id: string; type: "parent-child" | "partner"; from: string; to: string };
export type FamilyTree = { id: string; name: string; people: Person[]; relationships: Relationship[]; updatedAt: string };
export type WorkspaceData = { version: 1; activeTreeId: string; trees: FamilyTree[] };

export const uid = () => crypto.randomUUID();
export const emptyPerson = (): Person => ({ id: uid(), firstName: "", lastName: "", gender: "unspecified", birthDate: "", deathDate: "", notes: "", photo: "" });
export const newTree = (name = "My Family Tree"): FamilyTree => ({ id: uid(), name, people: [], relationships: [], updatedAt: new Date().toISOString() });
export const initialData = (): WorkspaceData => { const tree = newTree(); return { version: 1, activeTreeId: tree.id, trees: [tree] }; };

export function displayName(person: Person) { return `${person.firstName} ${person.lastName}`.trim() || "Unnamed person"; }
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
  return { ...tree, id: uid(), name: `${tree.name} (Imported)`, updatedAt: new Date().toISOString() } as FamilyTree;
}

export type NodeLayout = { id: string; x: number; y: number };
export function layoutTree(tree: FamilyTree): NodeLayout[] {
  if (!tree.people.length) return [];
  const levels = new Map<string, number>();
  const roots = tree.people.filter(p => parentsOf(tree, p.id).length === 0);
  const queue = roots.map(p => ({ id: p.id, level: 0 }));
  while (queue.length) { const item = queue.shift()!; if ((levels.get(item.id) ?? -1) >= item.level) continue; levels.set(item.id, item.level); childrenOf(tree, item.id).forEach(id => queue.push({ id, level: item.level + 1 })); }
  tree.people.forEach(p => { if (!levels.has(p.id)) levels.set(p.id, 0); });
  const rows = new Map<number, string[]>();
  tree.people.forEach(p => { const level = levels.get(p.id)!; rows.set(level, [...(rows.get(level) ?? []), p.id]); });
  const nodes: NodeLayout[] = [];
  [...rows].sort(([a], [b]) => a - b).forEach(([level, ids]) => ids.forEach((id, index) => nodes.push({ id, x: (index - (ids.length - 1) / 2) * 250, y: level * 190 })));
  return nodes;
}
