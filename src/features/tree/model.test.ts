import { describe, expect, it } from "vitest";
import { addRelationship, emptyPerson, exportTree, importTree, layoutTree, newTree } from "./model";
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
