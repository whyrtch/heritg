import { describe, expect, it } from "vitest";
import { createJokowiDemoTree } from "../demoData";
import { addRelationship, emptyPerson, newTree, type FamilyTree, type Person } from "../model";
import { focusSelection, layoutFocus } from "./layoutFocus";
import { GRID, NODE_R, layoutFull } from "./layoutFull";

const person = (id: string, extra: Partial<Person> = {}): Person => ({ ...emptyPerson(), id, name: id, ...extra });
/** Kakek+Nenek → Ayah (+Ibu), Om; Ayah+Ibu → Kakak, Aku (+Pasangan) ; Aku+Pasangan → Anak → Cucu */
function family(): FamilyTree {
  let tree: FamilyTree = { ...newTree(), people: ["kakek", "nenek", "ayah", "ibu", "om", "aku", "pasangan", "kakak", "anak", "cucu"].map(id => person(id)) };
  tree.people.find(p => p.id === "kakak")!.birthOrder = 1;
  tree.people.find(p => p.id === "aku")!.birthOrder = 2;
  const link = (type: "partner" | "parent-child", from: string, to: string, details = {}) => { tree = addRelationship(tree, type, from, to, details); };
  link("partner", "kakek", "nenek");
  link("parent-child", "kakek", "ayah"); link("parent-child", "nenek", "ayah");
  link("parent-child", "kakek", "om"); link("parent-child", "nenek", "om");
  link("partner", "ayah", "ibu");
  link("parent-child", "ayah", "aku"); link("parent-child", "ibu", "aku");
  link("parent-child", "ayah", "kakak"); link("parent-child", "ibu", "kakak", { kind: "step" });
  link("partner", "aku", "pasangan", { status: "ex" });
  link("parent-child", "aku", "anak");
  link("parent-child", "anak", "cucu");
  return tree;
}
const at = (layout: ReturnType<typeof layoutFull>, id: string) => layout.nodes.find(node => node.id === id)!;

describe("layoutFull", () => {
  it("puts each generation on its own 260 px row", () => {
    const layout = layoutFull(family());
    expect([at(layout, "kakek").y, at(layout, "ayah").y, at(layout, "aku").y, at(layout, "anak").y, at(layout, "cucu").y]).toEqual([0, GRID, 2 * GRID, 3 * GRID, 4 * GRID]);
    expect(at(layout, "ibu").y).toBe(at(layout, "ayah").y);
  });

  it("keeps partners adjacent and never overlaps people in a row", () => {
    const layout = layoutFull(family());
    expect(Math.abs(at(layout, "kakek").x - at(layout, "nenek").x)).toBe(GRID);
    expect(Math.abs(at(layout, "aku").x - at(layout, "pasangan").x)).toBe(GRID);
    for (const row of new Set(layout.nodes.map(node => node.y))) {
      const xs = layout.nodes.filter(node => node.y === row).map(node => node.x).sort((a, b) => a - b);
      xs.slice(1).forEach((x, index) => expect(x - xs[index]).toBeGreaterThanOrEqual(GRID));
    }
  });

  it("orders siblings by birth order and centres them under their parents", () => {
    const layout = layoutFull(family());
    expect(at(layout, "kakak").x).toBeLessThan(at(layout, "aku").x);
    const parentsMid = (at(layout, "kakek").x + at(layout, "nenek").x) / 2;
    expect((at(layout, "ayah").x + at(layout, "om").x) / 2).toBeCloseTo(parentsMid, 0);
  });

  it("draws partner lines between circles and orthogonal parent lines into the child's top", () => {
    const layout = layoutFull(family());
    const couple = layout.edges.find(edge => edge.type === "partner" && edge.id === family().relationships[0].id) ?? layout.edges.find(edge => edge.type === "partner")!;
    expect(couple.d).toMatch(/^M -?\d+(\.\d+)? \d+ H -?\d+/);
    const toAku = layout.edges.find(edge => edge.id.endsWith(">aku"))!;
    expect(toAku.d.endsWith(`V ${at(layout, "aku").y - NODE_R}`)).toBe(true);
    expect(toAku.id.split(">")[0].split("+").sort()).toEqual(["ayah", "ibu"]);
  });

  it("dashes ex-partners and links that are entirely non-biological", () => {
    const layout = layoutFull(family());
    expect(layout.edges.find(edge => edge.type === "partner" && edge.dashed)).toBeDefined();
    expect(layout.edges.find(edge => edge.id.endsWith(">kakak"))!.dashed).toBe(false); // one biological parent
    expect(layout.edges.find(edge => edge.id.endsWith(">aku"))!.dashed).toBe(false);
  });

  it("lays out the example tree without overlaps and within bounds", () => {
    const layout = layoutFull(createJokowiDemoTree());
    expect(layout.nodes).toHaveLength(20);
    expect(new Set(layout.nodes.map(node => `${node.x},${node.y}`)).size).toBe(20);
    layout.nodes.forEach(node => {
      expect(node.x).toBeGreaterThan(layout.bounds.minX);
      expect(node.x).toBeLessThan(layout.bounds.maxX);
      expect(node.y + NODE_R).toBeLessThan(layout.bounds.maxY);
    });
  });

  it("handles an empty tree", () => {
    expect(layoutFull({ people: [], relationships: [] }).nodes).toEqual([]);
  });
});

describe("layoutFocus", () => {
  it("shows the person, partners, parents and children by default", () => {
    const { ids, moreAncestors, moreDescendants } = focusSelection(family(), "aku");
    expect([...ids].sort()).toEqual(["aku", "anak", "ayah", "ibu", "pasangan"]);
    expect(moreAncestors).toBe(true);
    expect(moreDescendants).toBe(true);
  });

  it("adds siblings and extra generations on request", () => {
    const { ids, moreAncestors, moreDescendants } = focusSelection(family(), "aku", { siblings: true, ancestorDepth: 2, descendantDepth: 2 });
    expect(ids.has("kakak")).toBe(true);
    expect(ids.has("kakek") && ids.has("nenek")).toBe(true);
    expect(ids.has("om")).toBe(false);
    expect(ids.has("cucu")).toBe(true);
    expect(moreAncestors).toBe(false);
    expect(moreDescendants).toBe(false);
  });

  it("lays out only the selection", () => {
    const layout = layoutFocus(family(), "aku");
    expect(layout.nodes.map(node => node.id).sort()).toEqual(["aku", "anak", "ayah", "ibu", "pasangan"]);
    expect(layout.edges.every(edge => !edge.id.includes("kakek"))).toBe(true);
  });

  it("returns nothing for an unknown person", () => {
    expect(focusSelection(family(), "nobody").ids.size).toBe(0);
  });
});
