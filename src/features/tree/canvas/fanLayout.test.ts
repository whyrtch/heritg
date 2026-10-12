import { describe, expect, it } from "vitest";
import { createJokowiDemoTree } from "../demoData";
import { emptyPerson, makeRelationship, type FamilyTree, type Person } from "../model";
import { layoutFan } from "./fanLayout";

type Link = [string, string] | [string, string, "biological" | "step"];
const p = (id: string, over: Partial<Person> = {}): Person => ({ ...emptyPerson(), id, name: id, ...over });
const mk = (people: Person[], links: Link[]): FamilyTree => ({
  id: "t", name: "t", people, updatedAt: "",
  relationships: links.map(([from, to, kind]) => makeRelationship("parent-child", from, to, { kind: kind })),
});
const slot = (l: ReturnType<typeof layoutFan>, g: number, i: number) => l.ancestors.find(s => s.key === `a${g}.${i}`);
const numbers = (path: string) => path.match(/-?\d+(\.\d+)?/g)!.map(Number);
/** [x,y] of the four corners: M outer-start, outer-end, inner-end, inner-start. */
function corners(path: string): [number, number][] {
  const m = path.match(/^M (\S+) (\S+) A \S+ \S+ 0 \d 1 (\S+) (\S+) L (\S+) (\S+) A \S+ \S+ 0 \d 0 (\S+) (\S+) Z$/)!;
  expect(m).not.toBeNull();
  const n = m.slice(1).map(Number);
  return [[n[0], n[1]], [n[2], n[3]], [n[4], n[5]], [n[6], n[7]]];
}
const all = (l: ReturnType<typeof layoutFan>) => [...l.ancestors, ...l.children];

describe("layoutFan", () => {
  const demo = createJokowiDemoTree();

  it("puts Joko Widodo's ancestors in the right slots over 3 generations", () => {
    const l = layoutFan(demo, "jokowi", 3);
    expect(l.root).toEqual({ personId: "jokowi", gender: "male" });
    expect(slot(l, 1, 0)).toMatchObject({ personId: "widjiatno", gender: "male", generation: 1, relation: { kind: "parent", ofId: "jokowi" } });
    expect(slot(l, 1, 1)).toMatchObject({ personId: "sudjiatmi", gender: "female" });
    expect([0, 1, 2, 3].map(i => slot(l, 2, i)?.personId)).toEqual(["lamidi", "painem", "wiroredjo", "insani"]);
    expect(slot(l, 2, 0)!.relation).toEqual({ kind: "grandparent", ofId: "widjiatno" });
    expect(slot(l, 2, 3)!.relation).toEqual({ kind: "grandparent", ofId: "sudjiatmi" });
    // ring 3: the grandparents have no recorded parents -> 8 placeholders
    const ring3 = l.ancestors.filter(s => s.generation === 3);
    expect(ring3).toHaveLength(8);
    expect(ring3.every(s => s.personId === null && s.gender === null && s.relation.kind === "ancestor")).toBe(true);
    expect(l.ancestors).toHaveLength(2 + 4 + 8);
  });

  it("only makes placeholders for missing parents of known people, and nothing above them", () => {
    const tree = mk([p("me"), p("dad", { gender: "male" }), p("gdad", { gender: "male" })], [["dad", "me"], ["gdad", "dad"]]);
    const l = layoutFan(tree, "me", 4);
    expect(slot(l, 1, 0)!.personId).toBe("dad");
    expect(slot(l, 1, 1)).toMatchObject({ personId: null, relation: { ofId: "me" } });
    expect(slot(l, 2, 0)!.personId).toBe("gdad");
    expect(slot(l, 2, 1)).toMatchObject({ personId: null, relation: { ofId: "dad" } });
    // nothing above placeholder a1.1 (slots 2,3 of ring 2) or above gdad's placeholders (ring 3 slots 0,1 are gdad's; 2,3 do not exist)
    expect(slot(l, 2, 2)).toBeUndefined();
    expect(slot(l, 2, 3)).toBeUndefined();
    expect(slot(l, 3, 0)).toMatchObject({ personId: null, relation: { ofId: "gdad" } });
    expect(slot(l, 3, 1)).toMatchObject({ personId: null });
    expect(slot(l, 3, 2)).toBeUndefined();
    expect(l.ancestors.filter(s => s.generation === 4)).toHaveLength(0); // gdad's slots are placeholders
  });

  it("a person with no parents gets two placeholders; unrecorded root shows only ring 1", () => {
    const l = layoutFan(mk([p("solo")], []), "solo", 3);
    expect(l.ancestors.map(s => [s.key, s.personId])).toEqual([["a1.0", null], ["a1.1", null]]);
  });

  it("prefers biological parents, then fills with other kinds; a male parent takes the first slot", () => {
    const tree = mk(
      [p("kid"), p("mum", { gender: "female" }), p("stepdad", { gender: "male" }), p("dad", { gender: "male" }), p("extra")],
      [["mum", "kid"], ["stepdad", "kid", "step"], ["dad", "kid"], ["extra", "kid", "step"]]
    );
    const l = layoutFan(tree, "kid", 1);
    expect(l.ancestors.map(s => s.personId)).toEqual(["dad", "mum"]);
    const one = layoutFan(mk([p("kid"), p("sd", { gender: "male" })], [["sd", "kid", "step"]]), "kid", 1);
    expect(one.ancestors.map(s => s.personId)).toEqual(["sd", null]);
  });

  it("lists children by birth order (nulls last), then birth date (empty last), then name", () => {
    const tree = mk(
      [p("r"), p("z", { birthOrder: 1 }), p("b", { birthDate: "2000-01-01" }), p("a", { birthDate: "2000-01-01" }), p("early", { birthDate: "1990-05-05" }), p("none")],
      [["r", "none"], ["r", "b"], ["r", "z"], ["r", "a"], ["r", "early", "step"], ["r", "z"]]
    );
    const l = layoutFan(tree, "r", 1);
    expect(l.children.map(s => s.personId)).toEqual(["z", "early", "a", "b", "none"]);
    expect(l.children.every(s => s.generation === -1 && s.relation.kind === "child" && s.relation.ofId === "r")).toBe(true);
    expect(l.children[0].key).toBe("c.0");
  });

  it("splits the lower half equally among the children, left to right", () => {
    const l = layoutFan(demo, "jokowi", 1);
    expect(l.children.map(s => s.personId)).toEqual(["gibran", "kahiyang", "kaesang"]); // by birth date
    const xs = l.children.map(s => s.labelX);
    expect(xs[0]).toBeLessThan(xs[1]);
    expect(xs[1]).toBeLessThan(xs[2]);
    expect(l.children.every(s => s.labelY > l.cy)).toBe(true);
  });

  it("clamps generations to 1..5", () => {
    const chain: Person[] = [p("p0")];
    const links: Link[] = [];
    for (let i = 1; i <= 8; i += 1) { chain.push(p(`p${i}`, { gender: "male" })); links.push([`p${i}`, `p${i - 1}`]); }
    const tree = mk(chain, links);
    const maxGen = (g: number) => Math.max(...layoutFan(tree, "p0", g).ancestors.map(s => s.generation));
    expect(maxGen(0)).toBe(1);
    expect(maxGen(-3)).toBe(1);
    expect(maxGen(99)).toBe(5);
    expect(maxGen(Number.NaN)).toBe(3);
    expect(maxGen(2.9)).toBe(2);
  });

  it("makes well-formed paths, upright labels and the ring-1 rotations of -45 / 45", () => {
    const l = layoutFan(demo, "jokowi", 5);
    for (const s of all(l)) {
      expect(numbers(s.path).every(Number.isFinite)).toBe(true);
      expect(s.path).not.toMatch(/NaN|undefined/);
      expect(Number.isFinite(s.labelX) && Number.isFinite(s.labelY)).toBe(true);
      expect(s.rotate).toBeGreaterThanOrEqual(-90);
      expect(s.rotate).toBeLessThanOrEqual(90);
    }
    const ring1 = l.ancestors.filter(s => s.generation === 1).map(s => s.rotate).sort((a, b) => a - b);
    expect(ring1).toEqual([-45, 45]);
    expect(slot(l, 1, 0)!.rotate).toBe(-45); // left slot
    expect(slot(l, 1, 1)!.rotate).toBe(45);
  });

  it("sizes the viewBox to the outermost drawn radius plus a 6 margin", () => {
    const none = layoutFan(mk([p("x")], []), "x", 1);
    // ring 1 placeholders are drawn: R = 150
    expect(none.viewBox).toEqual({ x: 0, y: 0, width: 312, height: 156 + 52 + 6 });
    expect([none.cx, none.cy]).toEqual([156, 156]);

    const withKids = layoutFan(demo, "jokowi", 3);
    const R = 72 + 2 * 80 + 78; // ring 3 outer
    expect(withKids.viewBox).toEqual({ x: 0, y: 0, width: 2 * (R + 6), height: R + 6 + 150 + 6 });
    expect([withKids.cx, withKids.cy]).toEqual([R + 6, R + 6]);

    const leaf = layoutFan(demo, "bebingah", 1);
    expect(leaf.children).toHaveLength(0);
    expect(leaf.viewBox.height).toBe(leaf.cy + 52 + 6);
  });

  it("keeps every segment corner inside the viewBox", () => {
    for (const [root, gens] of [["jokowi", 5], ["jokowi", 3], ["gibran", 2], ["bebingah", 4]] as const) {
      const l = layoutFan(demo, root, gens);
      const { width, height } = l.viewBox;
      for (const s of all(l)) {
        for (const [x, y] of corners(s.path)) {
          expect(x).toBeGreaterThanOrEqual(0);
          expect(x).toBeLessThanOrEqual(width);
          expect(y).toBeGreaterThanOrEqual(0);
          expect(y).toBeLessThanOrEqual(height);
        }
      }
    }
  });

  it("survives a cycle in the parent links", () => {
    const tree = mk([p("a"), p("b", { gender: "male" }), p("c")], [["b", "a"], ["c", "b"], ["a", "c"], ["a", "b"]]);
    const l = layoutFan(tree, "a", 5);
    expect(l.ancestors.length).toBeLessThan(2 ** 6);
    expect(slot(l, 1, 0)!.personId).toBe("b");
    expect(slot(l, 2, 0)!.personId).toBe("c"); // b's first parent (male first; a is blocked as a cycle)
    // c's parent a is already on the path: placeholder, and nothing above it
    const above = l.ancestors.filter(s => s.generation === 3);
    expect(above.every(s => s.personId === null)).toBe(true);
    expect(l.ancestors.every(s => s.personId !== "a")).toBe(true);
  });

  it("throws for an unknown root", () => {
    expect(() => layoutFan(demo, "nobody", 3)).toThrow();
  });
});
