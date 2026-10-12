import { describe, expect, it } from "vitest";
import { addRelationship, connectorPath, displayName, normalizePerson, normalizeRelationship, emptyPerson, exportTree, generationCount, importTree, layoutTree, lifeDatesLong, lifespanLabel, newTree, relativesOf } from "./model";
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
  it("imports v1 .heritg files and upgrades them to v2", () => {
    const v1 = { version: 1, tree: { id: "x", name: "Lama", updatedAt: "2026-01-01T00:00:00.000Z", people: [{ id: "a", firstName: "Ani", lastName: "Sari", gender: "nonbinary", birthDate: "", deathDate: "", notes: "", photoUrl: "" }, { id: "b", firstName: "Bayu", lastName: "", gender: "male", birthDate: "", deathDate: "", notes: "", photoUrl: "" }], relationships: [{ id: "r", type: "partner", from: "a", to: "b" }] } };
    const tree = importTree(JSON.stringify(v1));
    expect(tree.name).toBe("Lama (Impor)");
    expect(tree.people[0]).toMatchObject({ name: "Ani Sari", gender: "unspecified", birthOrder: null, residence: "" });
    expect(tree.relationships[0]).toMatchObject({ kind: null, status: "married", marriedOn: "" });
    expect(JSON.parse(exportTree(tree)).version).toBe(2);
  });
  it("normalizes people and relationships idempotently", () => {
    const person = normalizePerson({ id: "p", name: "Rina", gender: "female", birthOrder: 3, residence: "Solo" });
    expect(normalizePerson(person as unknown as Record<string, unknown>)).toEqual(person);
    expect(normalizePerson({ id: "p", name: "X", birthOrder: 0 }).birthOrder).toBeNull();
    expect(normalizePerson({ id: "p", name: "X", birthOrder: 2.5 }).birthOrder).toBeNull();
    expect(normalizeRelationship({ id: "r", type: "parent-child", from: "a", to: "b", kind: "foster", status: "married", marriedOn: "2000-01-01" })).toEqual({ id: "r", type: "parent-child", from: "a", to: "b", kind: "foster", status: null, marriedOn: "" });
    expect(normalizeRelationship({ id: "r", type: "partner", from: "a", to: "b", kind: "step", status: "ex", marriedOn: "1990-01-01" })).toEqual({ id: "r", type: "partner", from: "a", to: "b", kind: null, status: "ex", marriedOn: "1990-01-01" });
    expect(displayName({ name: "  " })).toBe("Tanpa nama");
  });
  it("keeps upgraded and imported values inside the server limits", () => {
    expect(normalizePerson({ id: "p", firstName: "a".repeat(100), lastName: "b".repeat(30) }).name).toHaveLength(120);
    expect(normalizePerson({ id: "p", firstName: "   ", lastName: "" }).name).toBe("Tanpa nama");
    expect(normalizePerson({ id: "p", name: "X", birthOrder: 150 }).birthOrder).toBeNull();
    expect(normalizePerson({ id: "p", name: "X", residence: "r".repeat(200) }).residence).toHaveLength(120);
    expect(normalizeRelationship({ id: "r", type: "partner", from: "a", to: "b", marriedOn: "1990" }).marriedOn).toBe("");
    const file = { version: 2, tree: { id: "x", name: "Aneh", updatedAt: "2026-01-01T00:00:00.000Z", people: [{ id: "a", name: "A" }, { id: "b", name: "B" }], relationships: [{ id: "r", type: "sibling", from: "a", to: "b" }] } };
    expect(() => importTree(JSON.stringify(file))).toThrow(/unknown relationship type/i);
  });
  it("stores relationship details by type", () => {
    const base = { ...newTree(), people: [{ ...emptyPerson(), id: "a" }, { ...emptyPerson(), id: "b" }] };
    expect(addRelationship(base, "parent-child", "a", "b", { kind: "step" }).relationships[0]).toMatchObject({ kind: "step", status: null, marriedOn: "" });
    expect(addRelationship(base, "partner", "a", "b", { status: "ex", marriedOn: "1980-02-02" }).relationships[0]).toMatchObject({ kind: null, status: "ex", marriedOn: "1980-02-02" });
    expect(addRelationship(base, "parent-child", "a", "b").relationships[0].kind).toBe("biological");
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

describe("relativesOf", () => {
  it("groups parents, partners and children", () => {
    const tree = createJokowiDemoTree();
    const names = (people: { id: string }[]) => people.map(person => person.id);
    const relatives = relativesOf(tree, "jokowi");
    expect(names(relatives.parents)).toEqual(["widjiatno", "sudjiatmi"]);
    expect(names(relatives.partners)).toEqual(["iriana"]);
    expect(names(relatives.children)).toEqual(["gibran", "kahiyang", "kaesang"]);
    expect(names(relativesOf(tree, "iriana").partners)).toEqual(["jokowi"]);
  });
});

describe("portable .heritg photos", () => {
  it("drops another account's server photo paths on import but keeps embedded images", () => {
    const file = { version: 2, tree: { id: "x", name: "Foto", updatedAt: "2026-01-01T00:00:00.000Z", people: [{ id: "a", name: "A", photo: "/api/trees/other/people/a/photo?v=0123456789abcdef" }, { id: "b", name: "B", photo: "data:image/webp;base64,AAAA" }], relationships: [] } };
    const imported = importTree(JSON.stringify(file));
    expect(imported.people.map(person => person.photo)).toEqual(["", "data:image/webp;base64,AAAA"]);
  });
});
