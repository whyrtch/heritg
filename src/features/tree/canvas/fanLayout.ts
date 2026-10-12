import { displayName, type FamilyTree, type Gender, type Person } from "../model";

/**
 * Kipas (fan chart) geometry. Pure: no DOM, no React.
 * Angles are SVG angles in degrees (x = cx + r cos a, y = cy + r sin a, y grows downwards), so 180 is the left,
 * 270 the top, 360 the right and 90 the bottom.
 * - Ancestors fill the upper half (180 -> 360), ring g in 2^g equal slots ordered left to right.
 * - Children fill one ring in the lower half, ordered left to right as well (angle 180 -> 0), equal slots.
 * - Labels are rotated along the tangent and flipped when needed so they stay within -90..90 (never upside down).
 */
export type FanSegment = {
  key: string;
  personId: string | null; // null = placeholder ("Belum tercatat")
  generation: number; // 1.. for ancestors, -1 for children
  path: string;
  labelX: number; labelY: number; rotate: number;
  gender: Gender | null;
  relation: { kind: "parent" | "grandparent" | "ancestor" | "child"; ofId: string };
};
export type FanLayout = {
  viewBox: { x: number; y: number; width: number; height: number };
  cx: number; cy: number; rootR: number;
  root: { personId: string; gender: Gender };
  ancestors: FanSegment[];
  children: FanSegment[];
};

export const FAN_ROOT_R = 52;
export const FAN_MIN_GENERATIONS = 1, FAN_MAX_GENERATIONS = 5;
const RING_GAP_START = 72, RING_STEP = 80, RING_WIDTH = 78, MARGIN = 6;
const CHILD_INNER = 72, CHILD_OUTER = 150;

const round = (n: number) => Math.round(n * 1000) / 1000;
const rad = (deg: number) => (deg * Math.PI) / 180;

/** Tangent label rotation (text follows the arc) for a mid-angle, normalised into -90..90. */
function labelRotation(angle: number) {
  let a = (((angle + 90) % 360) + 540) % 360 - 180; // (-180, 180]
  if (a > 90) a -= 180;
  else if (a < -90) a += 180;
  return round(a === 0 ? 0 : a);
}

function sector(cx: number, cy: number, inner: number, outer: number, from: number, to: number) {
  const pt = (r: number, a: number) => `${round(cx + r * Math.cos(rad(a)))} ${round(cy + r * Math.sin(rad(a)))}`;
  const large = to - from > 180 ? 1 : 0;
  const path = `M ${pt(outer, from)} A ${outer} ${outer} 0 ${large} 1 ${pt(outer, to)} L ${pt(inner, to)} A ${inner} ${inner} 0 ${large} 0 ${pt(inner, from)} Z`;
  const mid = (from + to) / 2, midR = (inner + outer) / 2;
  return { path, labelX: round(cx + midR * Math.cos(rad(mid))), labelY: round(cy + midR * Math.sin(rad(mid))), rotate: labelRotation(mid) };
}

const isBiological = (kind: string | null | undefined) => kind == null || kind === "biological";

/** At most two parents: biological ones first, then the other kinds, in relationship order; a male parent takes the first slot. */
function pickParents(tree: FamilyTree, byId: Map<string, Person>, id: string): Person[] {
  const seen = new Set<string>();
  const bio: Person[] = [], other: Person[] = [];
  for (const r of tree.relationships) {
    if (r.type !== "parent-child" || r.to !== id) continue;
    const parent = byId.get(r.from);
    if (!parent || seen.has(parent.id)) continue;
    seen.add(parent.id);
    (isBiological(r.kind) ? bio : other).push(parent);
  }
  const two = [...bio, ...other].slice(0, 2);
  if (two.length === 2 && two[0].gender !== "male" && two[1].gender === "male") two.reverse();
  return two;
}

const byBirth = (a: Person, b: Person) => {
  const order = (a.birthOrder ?? Infinity) - (b.birthOrder ?? Infinity);
  if (order !== 0 && !Number.isNaN(order)) return order;
  if (a.birthDate !== b.birthDate) {
    if (!a.birthDate) return 1;
    if (!b.birthDate) return -1;
    return a.birthDate < b.birthDate ? -1 : 1;
  }
  return displayName(a).localeCompare(displayName(b));
};

export function layoutFan(tree: FamilyTree, rootId: string, generations: number): FanLayout {
  const gens = Math.min(FAN_MAX_GENERATIONS, Math.max(FAN_MIN_GENERATIONS, Math.trunc(Number.isFinite(generations) ? generations : 3)));
  const byId = new Map(tree.people.map(person => [person.id, person]));
  const root = byId.get(rootId);
  if (!root) throw new Error(`layoutFan: unknown person ${rootId}`);

  // Collect the slots first: the centre depends on the outermost radius actually drawn.
  type Slot = { g: number; i: number; person: Person | null; ofId: string };
  const slots: Slot[] = [];
  const walk = (person: Person, g: number, index: number, path: Set<string>) => {
    // person sits in ring g-1 slot `index`; its parents fill ring g slots 2*index and 2*index+1
    if (g > gens) return;
    const parents = pickParents(tree, byId, person.id);
    const next = new Set(path).add(person.id);
    for (let k = 0; k < 2; k += 1) {
      const parent = parents[k] && !next.has(parents[k].id) ? parents[k] : null; // a cycle is a placeholder
      slots.push({ g, i: index * 2 + k, person: parent, ofId: person.id });
      if (parent) walk(parent, g + 1, index * 2 + k, next);
    }
  };
  walk(root, 1, 0, new Set());

  const kids = [...new Set(tree.relationships.filter(r => r.type === "parent-child" && r.from === root.id).map(r => r.to))]
    .map(id => byId.get(id)).filter((p): p is Person => !!p && p.id !== root.id).sort(byBirth);

  const maxGen = slots.reduce((m, s) => Math.max(m, s.g), 0);
  const ringOuter = (g: number) => RING_GAP_START + (g - 1) * RING_STEP + RING_WIDTH;
  const R = Math.max(FAN_ROOT_R, maxGen ? ringOuter(maxGen) : 0, kids.length ? CHILD_OUTER : 0);
  const cx = R + MARGIN, cy = R + MARGIN;

  const relationKind = (g: number) => (g === 1 ? "parent" : g === 2 ? "grandparent" : "ancestor") as FanSegment["relation"]["kind"];
  const ancestors: FanSegment[] = slots.map(s => {
    const count = 2 ** s.g, span = 180 / count;
    const inner = RING_GAP_START + (s.g - 1) * RING_STEP;
    const geo = sector(cx, cy, inner, inner + RING_WIDTH, 180 + s.i * span, 180 + (s.i + 1) * span);
    return { key: `a${s.g}.${s.i}`, personId: s.person?.id ?? null, generation: s.g, ...geo, gender: s.person?.gender ?? null, relation: { kind: relationKind(s.g), ofId: s.ofId } };
  });

  const childSpan = kids.length ? 180 / kids.length : 0;
  const children: FanSegment[] = kids.map((kid, i) => {
    const geo = sector(cx, cy, CHILD_INNER, CHILD_OUTER, 180 - (i + 1) * childSpan, 180 - i * childSpan);
    return { key: `c.${i}`, personId: kid.id, generation: -1, ...geo, gender: kid.gender, relation: { kind: "child", ofId: root.id } };
  });

  const bottom = cy + (kids.length ? CHILD_OUTER : FAN_ROOT_R) + MARGIN;
  return {
    viewBox: { x: 0, y: 0, width: round(2 * (R + MARGIN)), height: round(bottom) },
    cx, cy, rootR: FAN_ROOT_R,
    root: { personId: root.id, gender: root.gender },
    ancestors, children,
  };
}
