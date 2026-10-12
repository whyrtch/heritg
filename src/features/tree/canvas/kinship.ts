import type { FamilyTree, Gender, ParentKind, PartnerStatus, Person } from "../model";
import { KINSHIP_TERMS } from "./kinshipTerms";

export type KinshipDialect = "id" | "jv-yogya" | "ms" | "en";

/**
 * Every relationship term the engine can produce. Gendered keys have a neutral twin used when the
 * other person's gender is "unspecified" (e.g. father / mother / parent). Older/younger variants
 * exist only for siblings and uncles/aunts, and are used only when birthOrder or birth dates allow.
 */
export type KinshipKey =
  | "self"
  | "father" | "mother" | "parent"
  | "grandfather" | "grandmother" | "grandparent"
  | "greatGrandfather" | "greatGrandmother" | "greatGrandparent"
  | "greatGreatGrandparent" | "ancestor"
  | "son" | "daughter" | "child"
  | "grandson" | "granddaughter" | "grandchild"
  | "greatGrandson" | "greatGranddaughter" | "greatGrandchild"
  | "greatGreatGrandchild" | "descendant"
  | "husband" | "wife" | "spouse" | "partner" | "exHusband" | "exWife" | "exSpouse"
  | "brother" | "sister" | "sibling"
  | "olderBrother" | "olderSister" | "olderSibling"
  | "youngerBrother" | "youngerSister" | "youngerSibling"
  | "uncle" | "aunt" | "uncleAunt"
  | "olderUncle" | "olderAunt" | "olderUncleAunt"
  | "youngerUncle" | "youngerAunt" | "youngerUncleAunt"
  | "grandUncle" | "grandAunt" | "grandUncleAunt"
  | "nephew" | "niece" | "nibling" | "grandNibling"
  | "cousin" | "secondCousin" | "distantCousin"
  | "fatherInLaw" | "motherInLaw" | "parentInLaw"
  | "sonInLaw" | "daughterInLaw" | "childInLaw"
  | "brotherInLaw" | "sisterInLaw" | "siblingInLaw"
  | "guardian" | "ward"
  | "inLawRelative" | "relative";

/** `step` / `adoptive` / `foster` come from the parent-child `kind` on the path; `half` from shared parents. */
export type Kinship = { key: KinshipKey; step?: boolean; adoptive?: boolean; foster?: boolean; half?: boolean };

export type KinshipModifier = "step" | "adoptive" | "foster" | "half";
/**
 * Plain-data term table. `modifiers` are templates: "{}" is the base term, "{lc}" its lower-case form.
 * `overrides` hold "<key>:<modifier>" entries that replace the templated result (e.g. "child:step").
 */
export type KinshipTable = {
  terms: Record<KinshipKey, string>;
  modifiers: Record<KinshipModifier, string>;
  overrides?: Partial<Record<`${KinshipKey}:${KinshipModifier}`, string>>;
};

type Tree = Pick<FamilyTree, "people" | "relationships">;
type Anc = { gen: number; flags: number; below: string };
type Ctx = {
  people: Map<string, Person>;
  parents: Map<string, { id: string; kind: ParentKind | null }[]>;
  partners: Map<string, { id: string; status: PartnerStatus | null }[]>;
  anc: Map<string, Map<string, Anc>>;
};
type Blood = { a: number; b: number; es: Anc; et: Anc };

const MAX_DEPTH = 12;
const STEP = 1, ADOPTIVE = 2, FOSTER = 4, GUARDIAN = 8;
const kindBit = (kind: ParentKind | null) => kind === "step" ? STEP : kind === "adoptive" ? ADOPTIVE : kind === "foster" ? FOSTER : kind === "guardian" ? GUARDIAN : 0;
const bits = (n: number) => { let c = 0; for (; n; n &= n - 1) c += 1; return c; };
const NO_MODIFIER = new Set<KinshipKey>(["self", "husband", "wife", "spouse", "partner", "exHusband", "exWife", "exSpouse", "guardian", "ward", "inLawRelative", "relative", "ancestor", "descendant"]);

function buildCtx(tree: Tree): Ctx {
  const people = new Map<string, Person>();
  for (const person of tree.people) people.set(person.id, person);
  const parents: Ctx["parents"] = new Map(), partners: Ctx["partners"] = new Map();
  const push = <T,>(map: Map<string, T[]>, key: string, value: T) => { const list = map.get(key); if (list) list.push(value); else map.set(key, [value]); };
  for (const r of tree.relationships) {
    if (r.from === r.to || !people.has(r.from) || !people.has(r.to)) continue;
    if (r.type === "parent-child") push(parents, r.to, { id: r.from, kind: r.kind });
    else { push(partners, r.from, { id: r.to, status: r.status }); push(partners, r.to, { id: r.from, status: r.status }); }
  }
  return { people, parents, partners, anc: new Map() };
}

/** Ancestors of `id` (including itself at gen 0) with the shortest generation and the non-biological edges crossed. Cycle-safe. */
function ancestorsOf(ctx: Ctx, id: string): Map<string, Anc> {
  const cached = ctx.anc.get(id);
  if (cached) return cached;
  const result = new Map<string, Anc>([[id, { gen: 0, flags: 0, below: "" }]]);
  let frontier = [id];
  for (let gen = 1; gen <= MAX_DEPTH && frontier.length; gen += 1) {
    const next = new Map<string, Anc>();
    for (const node of frontier) {
      const entry = result.get(node)!;
      for (const parent of ctx.parents.get(node) ?? []) {
        if (result.has(parent.id)) continue;
        const candidate: Anc = { gen, flags: entry.flags | kindBit(parent.kind), below: node };
        const current = next.get(parent.id);
        if (!current || bits(candidate.flags) < bits(current.flags)) next.set(parent.id, candidate);
      }
    }
    for (const [parentId, entry] of next) result.set(parentId, entry);
    frontier = [...next.keys()];
  }
  ctx.anc.set(id, result);
  return result;
}

/** Closest common ancestor (or one of the two people themselves) — a = steps up from `s`, b = steps down to `t`. */
function blood(ctx: Ctx, s: string, t: string): Blood | null {
  const fromS = ancestorsOf(ctx, s), fromT = ancestorsOf(ctx, t);
  let best: (Blood & { score: number; cost: number; id: string }) | null = null;
  for (const [id, es] of fromS) {
    const et = fromT.get(id);
    if (!et) continue;
    const score = es.gen + et.gen, cost = bits(es.flags) + bits(et.flags);
    if (!best || score < best.score || (score === best.score && (cost < best.cost || (cost === best.cost && id < best.id)))) best = { a: es.gen, b: et.gen, es, et, score, cost, id };
  }
  return best && { a: best.a, b: best.b, es: best.es, et: best.et };
}

type Order = "older" | "younger" | null;
function orderOf(ctx: Ctx, t: string, ref: string, useBirthOrder = true): Order {
  const pt = ctx.people.get(t), pr = ctx.people.get(ref);
  if (!pt || !pr) return null;
  if (useBirthOrder && pt.birthOrder != null && pr.birthOrder != null && pt.birthOrder !== pr.birthOrder) return pt.birthOrder < pr.birthOrder ? "older" : "younger";
  if (pt.birthDate && pr.birthDate && pt.birthDate !== pr.birthDate) return pt.birthDate < pr.birthDate ? "older" : "younger";
  return null;
}

const pick = <K extends KinshipKey>(gender: Gender, male: K, female: K, neutral: K): K => gender === "male" ? male : gender === "female" ? female : neutral;
function siblingKey(gender: Gender, order: Order): KinshipKey {
  if (order === "older") return pick(gender, "olderBrother", "olderSister", "olderSibling");
  if (order === "younger") return pick(gender, "youngerBrother", "youngerSister", "youngerSibling");
  return pick(gender, "brother", "sister", "sibling");
}
function uncleKey(gender: Gender, order: Order): KinshipKey {
  if (order === "older") return pick(gender, "olderUncle", "olderAunt", "olderUncleAunt");
  if (order === "younger") return pick(gender, "youngerUncle", "youngerAunt", "youngerUncleAunt");
  return pick(gender, "uncle", "aunt", "uncleAunt");
}
const parentKey = (gender: Gender): KinshipKey => pick(gender, "father", "mother", "parent");
const childKey = (gender: Gender): KinshipKey => pick(gender, "son", "daughter", "child");
const ancestorKey = (gen: number, gender: Gender): KinshipKey =>
  gen === 1 ? parentKey(gender) : gen === 2 ? pick(gender, "grandfather", "grandmother", "grandparent")
    : gen === 3 ? pick(gender, "greatGrandfather", "greatGrandmother", "greatGrandparent") : gen === 4 ? "greatGreatGrandparent" : "ancestor";
const descendantKey = (gen: number, gender: Gender): KinshipKey =>
  gen === 1 ? childKey(gender) : gen === 2 ? pick(gender, "grandson", "granddaughter", "grandchild")
    : gen === 3 ? pick(gender, "greatGrandson", "greatGranddaughter", "greatGrandchild") : gen === 4 ? "greatGreatGrandchild" : "descendant";

function withFlags(key: KinshipKey, flags: number, extra: Partial<Kinship> = {}): Kinship {
  const result: Kinship = { key, ...extra };
  if (flags & STEP) result.step = true;
  if (flags & ADOPTIVE) result.adoptive = true;
  if (flags & FOSTER) result.foster = true;
  return result;
}

function bloodKinship(ctx: Ctx, s: string, t: string, bl: Blood): Kinship | null {
  const { a, b } = bl;
  const gender = ctx.people.get(t)!.gender;
  if (a === 0 && b === 0) return { key: "self" };
  if (b === 0) { // t is an ancestor of s — the edges crossed are on s's side
    if (a === 1 && bl.es.flags & GUARDIAN) return { key: "guardian" };
    return withFlags(ancestorKey(a, gender), bl.es.flags);
  }
  if (a === 0) {
    if (b === 1 && bl.et.flags & GUARDIAN) return { key: "ward" };
    return withFlags(descendantKey(b, gender), bl.et.flags);
  }
  const flags = bl.et.flags;
  if (a === 1 && b === 1) {
    const ps = (ctx.parents.get(s) ?? []).map(p => p.id), pt = (ctx.parents.get(t) ?? []).map(p => p.id);
    const shared = ps.filter(id => pt.includes(id)).length;
    const half = shared >= 1 && ps.some(id => !pt.includes(id)) && pt.some(id => !ps.includes(id));
    return withFlags(siblingKey(gender, orderOf(ctx, t, s)), flags, half ? { half: true } : {});
  }
  if (b === 1) { // a >= 2: t is a sibling of s's ancestor
    if (a === 2) return withFlags(uncleKey(gender, orderOf(ctx, t, bl.es.below)), flags);
    if (a === 3) return withFlags(pick(gender, "grandUncle", "grandAunt", "grandUncleAunt"), flags);
    return { key: "relative" };
  }
  if (a === 1) { // b >= 2: t descends from a sibling of s
    if (b === 2) return withFlags(pick(gender, "nephew", "niece", "nibling"), flags);
    if (b === 3) return withFlags("grandNibling", flags);
    return { key: "relative" };
  }
  if (a === b) return { key: a === 2 ? "cousin" : a === 3 ? "secondCousin" : "distantCousin" };
  return { key: "relative" };
}

const partnerKinship = (status: PartnerStatus | null, gender: Gender): Kinship =>
  status === "ex" ? { key: pick(gender, "exHusband", "exWife", "exSpouse") }
    : status === "partner" ? { key: "partner" } : { key: pick(gender, "husband", "wife", "spouse") };
const STATUS_RANK: Record<string, number> = { married: 0, partner: 1, ex: 2 };

function describeWith(ctx: Ctx, s: string, t: string): Kinship | null {
  const target = ctx.people.get(t);
  if (!target || !ctx.people.has(s)) return null;
  if (s === t) return { key: "self" };

  // 1. A direct partner link (best status wins: married > partner > ex).
  const direct = (ctx.partners.get(s) ?? []).filter(p => p.id === t).sort((x, y) => (STATUS_RANK[x.status ?? "married"] ?? 0) - (STATUS_RANK[y.status ?? "married"] ?? 0))[0];
  if (direct) return partnerKinship(direct.status, target.gender);

  // 2. Blood (including adoptive / step / foster edges along the path).
  const bl = blood(ctx, s, t);
  if (bl) return bloodKinship(ctx, s, t, bl);

  const live = (list: { id: string; status: PartnerStatus | null }[] | undefined) => (list ?? []).filter(p => p.status !== "ex");

  // 3. t is a blood relative of my (current) partner.
  for (const q of live(ctx.partners.get(s))) {
    const bq = blood(ctx, q.id, t);
    if (!bq) continue;
    if (bq.a === 1 && bq.b === 0) return { key: pick(target.gender, "fatherInLaw", "motherInLaw", "parentInLaw") };
    if (bq.a === 1 && bq.b === 1) return { key: pick(target.gender, "brotherInLaw", "sisterInLaw", "siblingInLaw") };
    if (bq.a === 0 && bq.b === 1) return { key: childKey(target.gender), step: true };
    return { key: "inLawRelative" };
  }

  // 4. t is the (current) partner of one of my blood relatives.
  for (const p of live(ctx.partners.get(t))) {
    const bp = blood(ctx, s, p.id);
    if (!bp) continue;
    if (bp.a === 0 && bp.b === 1) return { key: pick(target.gender, "sonInLaw", "daughterInLaw", "childInLaw") };
    if (bp.a === 1 && bp.b === 0) return { key: parentKey(target.gender), step: true };
    if (bp.a === 1 && bp.b === 1) return { key: pick(target.gender, "brotherInLaw", "sisterInLaw", "siblingInLaw") };
    if (bp.a === 2 && bp.b === 1) return { key: uncleKey(target.gender, orderOf(ctx, p.id, bp.es.below)) };
    return { key: "inLawRelative" };
  }

  // 5. Step-sibling: t is a child of the (current) partner of one of my parents.
  const myParents = new Set((ctx.parents.get(s) ?? []).map(p => p.id));
  const theirParents = new Set((ctx.parents.get(t) ?? []).map(p => p.id));
  for (const parent of myParents) {
    for (const q of live(ctx.partners.get(parent))) {
      if (!myParents.has(q.id) && theirParents.has(q.id)) return { key: siblingKey(target.gender, orderOf(ctx, t, s, false)), step: true };
    }
  }
  return null;
}

export function describeKinship(tree: Tree, fromId: string, toId: string): Kinship | null {
  return describeWith(buildCtx(tree), fromId, toId);
}

function render(kinship: Kinship, dialect: KinshipDialect): string {
  const table = KINSHIP_TERMS[dialect] ?? KINSHIP_TERMS.id;
  const base = table.terms[kinship.key];
  const modifier: KinshipModifier | null = NO_MODIFIER.has(kinship.key) ? null
    : kinship.step ? "step" : kinship.adoptive ? "adoptive" : kinship.foster ? "foster" : kinship.half ? "half" : null;
  if (!modifier) return base;
  const override = table.overrides?.[`${kinship.key}:${modifier}`];
  if (override) return override;
  return table.modifiers[modifier].replace("{lc}", base.toLowerCase()).replace("{}", base);
}

export function kinshipLabel(tree: Tree, fromId: string, toId: string, dialect: KinshipDialect = "id"): string {
  const kinship = describeKinship(tree, fromId, toId);
  return kinship ? render(kinship, dialect) : "";
}

/** Labels for every person relative to `fromId` ("" when unrelated). Builds the graph once. */
export function kinshipLabels(tree: Tree, fromId: string, dialect: KinshipDialect = "id"): Map<string, string> {
  const ctx = buildCtx(tree);
  const labels = new Map<string, string>();
  for (const person of tree.people) {
    const kinship = describeWith(ctx, fromId, person.id);
    labels.set(person.id, kinship ? render(kinship, dialect) : "");
  }
  return labels;
}
