import type { FamilyTree, Relationship } from "../model";

/** Generational grid: one column and one row step, measured on heritg.us. */
export const GRID = 260;
/** Node circle radius and inner (photo) radius. */
export const NODE_R = 32, NODE_INNER_R = 27;
/** Vertical space under a node taken by its name and relation label. */
export const LABEL_DEPTH = 86;

export type CanvasNode = { id: string; x: number; y: number; generation: number };
export type CanvasEdge =
  | { id: string; type: "partner"; d: string; dashed: boolean }
  | { id: string; type: "parent-child"; d: string; dashed: boolean };
export type CanvasBounds = { minX: number; minY: number; maxX: number; maxY: number };
export type CanvasLayout = { nodes: CanvasNode[]; edges: CanvasEdge[]; bounds: CanvasBounds };

type TreeGraph = Pick<FamilyTree, "people" | "relationships">;

/** Generation per person: partners share a row, children sit one row below their lowest parent. */
export function generations(tree: TreeGraph): Map<string, number> {
  const levels = new Map(tree.people.map(person => [person.id, 0]));
  const partners = tree.relationships.filter(r => r.type === "partner" && levels.has(r.from) && levels.has(r.to));
  const parentLinks = tree.relationships.filter(r => r.type === "parent-child" && levels.has(r.from) && levels.has(r.to));
  for (let pass = 0; pass < tree.people.length; pass += 1) {
    let changed = false;
    const raise = (id: string, level: number) => { if ((levels.get(id) ?? 0) < level) { levels.set(id, level); changed = true; } };
    partners.forEach(r => { const level = Math.max(levels.get(r.from)!, levels.get(r.to)!); raise(r.from, level); raise(r.to, level); });
    parentLinks.forEach(r => raise(r.to, levels.get(r.from)! + 1));
    if (!changed) break;
  }
  return levels;
}

/**
 * Order every generation so partners sit side by side and children sit under their parents, then place
 * people on the 260 px grid. Columns are absolute (not re-centred per row) so parents and children line up.
 */
export function layoutFull(tree: TreeGraph): CanvasLayout {
  if (!tree.people.length) return { nodes: [], edges: [], bounds: { minX: 0, minY: 0, maxX: 0, maxY: 0 } };
  const levels = generations(tree);
  const order = new Map(tree.people.map((person, index) => [person.id, index]));
  const parentsOf = new Map<string, string[]>();
  tree.relationships.forEach(r => { if (r.type === "parent-child" && levels.has(r.from) && levels.has(r.to)) parentsOf.set(r.to, [...(parentsOf.get(r.to) ?? []), r.from]); });
  const partnersOf = new Map<string, string[]>();
  tree.relationships.forEach(r => {
    if (r.type !== "partner" || !levels.has(r.from) || !levels.has(r.to) || levels.get(r.from) !== levels.get(r.to)) return;
    partnersOf.set(r.from, [...(partnersOf.get(r.from) ?? []), r.to]);
    partnersOf.set(r.to, [...(partnersOf.get(r.to) ?? []), r.from]);
  });

  // Siblings follow "anak ke-berapa", then date of birth, then the order they were added.
  const ranked = [...tree.people].sort((a, b) => (a.birthOrder ?? Infinity) - (b.birthOrder ?? Infinity) || (a.birthDate || "9999").localeCompare(b.birthDate || "9999") || order.get(a.id)! - order.get(b.id)!);
  const rank = new Map(ranked.map((person, index) => [person.id, index]));
  const siblingRank = (id: string) => rank.get(id) ?? order.get(id)!;
  const rows = new Map<number, string[]>();
  tree.people.forEach(person => { const level = levels.get(person.id)!; rows.set(level, [...(rows.get(level) ?? []), person.id]); });
  const x = new Map<string, number>();

  for (const level of [...rows.keys()].sort((a, b) => a - b)) {
    const ids = rows.get(level)!;
    // Partner clusters (connected components inside the row), each placed as one block.
    const seen = new Set<string>();
    const clusters: string[][] = [];
    for (const id of ids) {
      if (seen.has(id)) continue;
      const cluster: string[] = [], queue = [id];
      seen.add(id);
      while (queue.length) { const current = queue.shift()!; cluster.push(current); for (const partner of partnersOf.get(current) ?? []) if (!seen.has(partner)) { seen.add(partner); queue.push(partner); } }
      clusters.push(cluster);
    }
    const anchor = (id: string) => { const parents = (parentsOf.get(id) ?? []).filter(parent => x.has(parent)); return parents.length ? parents.reduce((sum, parent) => sum + x.get(parent)!, 0) / parents.length : null; };
    const placed = clusters.map(cluster => {
      // People with parents in the tree lead their cluster; married-in partners follow them.
      const members = [...cluster].sort((a, b) => {
        const pa = anchor(a), pb = anchor(b);
        if (pa !== null && pb !== null) return pa - pb || order.get(a)! - order.get(b)!;
        if (pa !== null) return -1;
        if (pb !== null) return 1;
        return order.get(a)! - order.get(b)!;
      });
      const anchors = members.map(anchor).filter((value): value is number => value !== null);
      const desired = anchors.length ? anchors.reduce((sum, value) => sum + value, 0) / anchors.length : null;
      return { members, desired, siblingRank: Math.min(...members.map(siblingRank)) };
    });
    placed.sort((a, b) => (a.desired ?? Infinity) - (b.desired ?? Infinity) || a.siblingRank - b.siblingRank);
    // Sibling blocks (clusters under the same parents) are centred under those parents; blocks never overlap,
    // so a crowded row spreads to the right. Clusters without parents in the tree are appended at the end.
    const blocks: (typeof placed)[] = [];
    for (const item of placed) {
      const last = blocks[blocks.length - 1];
      if (last && item.desired !== null && last[0].desired !== null && Math.abs(last[0].desired - item.desired) < 1) last.push(item);
      else blocks.push([item]);
    }
    let cursor = -Infinity;
    for (const block of blocks) {
      const ids = block.flatMap(item => item.members);
      const width = (ids.length - 1) * GRID;
      const desired = block[0].desired;
      let start = desired !== null ? desired - width / 2 : cursor === -Infinity ? 0 : cursor;
      if (start < cursor) start = cursor;
      ids.forEach((id, index) => x.set(id, start + index * GRID));
      cursor = start + width + GRID;
    }
  }

  const nodes: CanvasNode[] = tree.people.map(person => ({ id: person.id, x: x.get(person.id)!, y: levels.get(person.id)! * GRID, generation: levels.get(person.id)! }));
  // Centre the whole drawing on x = 0 so "no pan" shows the middle of the tree.
  const xs = nodes.map(node => node.x), shift = (Math.min(...xs) + Math.max(...xs)) / 2;
  nodes.forEach(node => { node.x -= shift; });
  return { nodes, edges: connectors(tree, nodes), bounds: boundsOf(nodes) };
}

export function boundsOf(nodes: CanvasNode[]): CanvasBounds {
  if (!nodes.length) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  const half = GRID / 2 - 10;
  return {
    minX: Math.min(...nodes.map(node => node.x)) - half,
    maxX: Math.max(...nodes.map(node => node.x)) + half,
    minY: Math.min(...nodes.map(node => node.y)) - NODE_R - 16,
    maxY: Math.max(...nodes.map(node => node.y)) + NODE_R + LABEL_DEPTH,
  };
}

const notBiological = (relationship: Relationship) => relationship.type === "parent-child" && relationship.kind !== null && relationship.kind !== "biological";

/**
 * Partner lines run straight between circles. Parent-child lines are orthogonal: they leave the middle of
 * the parents' partner line (or from under a single parent's labels), run along a bus line and drop into
 * the top of each child's circle. Step, adoptive, foster and guardian links and ex-partners are dashed.
 */
export function connectors(tree: TreeGraph, nodes: CanvasNode[]): CanvasEdge[] {
  const at = new Map(nodes.map(node => [node.id, node]));
  const edges: CanvasEdge[] = [];
  const partnerPairs = new Set<string>();
  for (const r of tree.relationships) {
    if (r.type !== "partner") continue;
    const a = at.get(r.from), b = at.get(r.to);
    if (!a || !b) continue;
    partnerPairs.add([r.from, r.to].sort().join("|"));
    const [left, right] = a.x <= b.x ? [a, b] : [b, a];
    const d = left.y === right.y ? `M ${left.x + NODE_R} ${left.y} H ${right.x - NODE_R}` : `M ${left.x} ${left.y + NODE_R} L ${right.x} ${right.y - NODE_R}`;
    edges.push({ id: r.id, type: "partner", d, dashed: r.status === "ex" });
  }
  // Group each child's links by its set of visible parents so siblings share one bus.
  const childLinks = new Map<string, Relationship[]>();
  tree.relationships.forEach(r => { if (r.type === "parent-child" && at.has(r.from) && at.has(r.to)) childLinks.set(r.to, [...(childLinks.get(r.to) ?? []), r]); });
  for (const [childId, links] of childLinks) {
    const child = at.get(childId)!;
    const parents = links.map(link => at.get(link.from)!).sort((a, b) => a.x - b.x);
    const couple = parents.length === 2 && parents[0].y === parents[1].y && partnerPairs.has([parents[0].id, parents[1].id].sort().join("|"));
    const groups = couple ? [parents] : parents.map(parent => [parent]);
    for (const group of groups) {
      const top = Math.max(...group.map(parent => parent.y));
      const startX = group.reduce((sum, parent) => sum + parent.x, 0) / group.length;
      const startY = group.length === 2 ? top : top + LABEL_DEPTH;
      const childTop = child.y - NODE_R;
      const busY = Math.max(startY + 12, childTop - 44);
      const d = startX === child.x ? `M ${startX} ${startY} V ${childTop}` : `M ${startX} ${startY} V ${busY} H ${child.x} V ${childTop}`;
      const dashed = links.filter(link => group.some(parent => parent.id === link.from)).every(notBiological);
      edges.push({ id: `${group.map(parent => parent.id).join("+")}>${childId}`, type: "parent-child", d, dashed });
    }
  }
  return edges;
}
