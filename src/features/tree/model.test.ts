import { describe, expect, it } from "vitest";
import { addRelationship, connectorPath, emptyPerson, exportTree, generationCount, importTree, layoutTree, lifeDatesLong, lifespanLabel, newTree } from "./model";
import { createJokowiDemoTree } from "./demoData";

describe("family model", () => {
  it("rejects ancestry cycles", () => {
    const a = emptyPerson(), b = emptyPerson();
    let tree = { ...newTree(), people: [a, b] };
    tree = addRelationship(tree, "parent-child", a.id, b.id);
    expect(() => addRelationship(tree, "parent-child", b.id, a.id)).toThrow(/cycle/i);
  });
  it("round trips exports", () => {
    const tree = { ...newTree("Oak"), people: [emptyPerson()] };
    expect(importTree(exportTree(tree)).people).toHaveLength(1);
  });
  it("places children below parents", () => {
    const a = emptyPerson(), b = emptyPerson();
    const tree = addRelationship({ ...newTree(), people: [a, b] }, "parent-child", a.id, b.id);
    const nodes = layoutTree(tree);
    expect(nodes.find(n => n.id === b.id)!.y).toBeGreaterThan(nodes.find(n => n.id === a.id)!.y);
  });
  it("keeps partners together across the Jokowi demo generations", () => {
    const nodes = layoutTree(createJokowiDemoTree());
    const y = (id: string) => nodes.find(node => node.id === id)!.y;
    expect(y("jokowi")).toBe(y("iriana"));
    expect(y("gibran")).toBe(y("selvi"));
    expect(y("jan-ethes")).toBeGreaterThan(y("gibran"));
  });
});

describe("display helpers", () => {
  const p = (birthDate = "", deathDate = "") => ({ ...emptyPerson(), birthDate, deathDate });
  it("labels lifespans by year", () => {
    expect(lifespanLabel(p("1961-06-21"))).toBe("Born 1961");
    expect(lifespanLabel(p("1940-12-30", "2000-07-23"))).toBe("1940 – 2000");
    expect(lifespanLabel(p("", "2015-10-23"))).toBe("Died 2015");
    expect(lifespanLabel(p())).toBe("Years unknown");
  });
  it("writes long dates without timezone drift", () => {
    expect(lifeDatesLong(p("1961-06-21"))).toBe("Born 21 June 1961");
    expect(lifeDatesLong(p("1940-12-30", "2000-07-23"))).toBe("Born 30 December 1940 · Died 23 July 2000");
    expect(lifeDatesLong(p())).toBe("Birth date unknown");
  });
  it("counts generations from the layout", () => {
    expect(generationCount(createJokowiDemoTree())).toBe(5);
    expect(generationCount(newTree())).toBe(0);
  });
  it("draws straight and rounded-elbow connectors", () => {
    const a = { id: "a", x: 0, y: 0 }, b = { id: "b", x: 0, y: 190 }, c = { id: "c", x: 250, y: 190 }, d = { id: "d", x: -250, y: 190 };
    expect(connectorPath(a, b, "parent-child")).toBe("M 105 108 V 190");
    expect(connectorPath(a, c, "parent-child")).toBe("M 105 108 V 137 Q 105 149 117 149 H 343 Q 355 149 355 161 V 190");
    expect(connectorPath(a, d, "parent-child")).toContain("Q 105 149 93 149");
    expect(connectorPath(c, b, "partner")).toBe("M 210 244 L 250 244");
  });
});
