import { describe, expect, it } from "vitest";
import { createJokowiDemoTree } from "../demoData";
import { addRelationship, emptyPerson, newTree, type FamilyTree, type Person } from "../model";
import { exportGedcom, importGedcom, looksLikeGedcom } from "./gedcom";

const on = { dates: true, marriageDates: true };
const person = (name: string, gender: Person["gender"], extra: Partial<Person> = {}): Person => ({ ...emptyPerson(), name, gender, ...extra });

function smallTree(): FamilyTree {
  const dad = person("Budi Santoso", "male", { birthDate: "1950-06-21", birthOrder: 2, residence: "Solo" });
  const mom = person("Siti", "female", { birthDate: "1955-03-01", deathDate: "2020-12-31", notes: "Guru" });
  const kid = person("Ani", "female", { birthDate: "1980-01-05" });
  let tree: FamilyTree = { ...newTree("Keluarga"), people: [dad, mom, kid] };
  tree = addRelationship(tree, "partner", dad.id, mom.id, { status: "married", marriedOn: "1975-08-17" });
  tree = addRelationship(tree, "parent-child", dad.id, kid.id, { kind: "adoptive" });
  tree = addRelationship(tree, "parent-child", mom.id, kid.id, { kind: "adoptive" });
  return tree;
}

describe("exportGedcom", () => {
  it("writes the header, CRLF lines, GEDCOM dates and PEDI", () => {
    const text = exportGedcom(smallTree(), on);
    expect(text.endsWith("0 TRLR\r\n")).toBe(true);
    expect(text.replace(/\r\n/g, "")).not.toMatch(/[\r\n]/);
    const lines = text.split("\r\n");
    expect(lines.slice(0, 7)).toEqual(["0 HEAD", "1 SOUR HERITG", "1 GEDC", "2 VERS 5.5.1", "2 FORM LINEAGE-LINKED", "1 CHAR UTF-8", "1 SUBM @U1@"]);
    expect(lines).toContain("1 NAME Budi Santoso //");
    expect(lines).toContain("2 DATE 21 JUN 1950");
    expect(lines).toContain("2 DATE 17 AUG 1975");
    expect(lines).toContain("1 _BIRTH_ORDER 2");
    expect(lines).toContain("2 PEDI adopted");
    expect(lines).toContain("1 HUSB @I1@");
    expect(lines).toContain("1 WIFE @I2@");
    expect(lines).toContain("1 CHIL @I3@");
    expect(lines).toContain("2 PLAC Solo");
  });

  it("strips birth and marriage dates when the privacy options are off", () => {
    const text = exportGedcom(smallTree(), { dates: false, marriageDates: false });
    expect(text).not.toMatch(/BIRT|DEAT|_BIRTH_ORDER|DATE/);
    expect(text).toContain("1 MARR Y");
    const noMarriage = exportGedcom(smallTree(), { dates: true, marriageDates: false });
    expect(noMarriage).toContain("2 DATE 21 JUN 1950");
    expect(noMarriage).not.toContain("17 AUG 1975");
  });

  it("splits long notes with CONC and newlines with CONT", () => {
    const tree = { ...newTree(), people: [person("A", "male", { notes: `${"x".repeat(450)}\nbaris dua` })] };
    const lines = exportGedcom(tree, on).split("\r\n");
    expect(lines.filter(l => l.startsWith("2 CONC")).length).toBe(2);
    expect(lines.some(l => l === "2 CONT baris dua")).toBe(true);
    expect(Math.max(...lines.map(l => l.length))).toBeLessThanOrEqual(210);
    expect(importGedcom(exportGedcom(tree, on)).people[0].notes).toBe(`${"x".repeat(450)}\nbaris dua`);
  });

  it("maps step and guardian parents to custom tags and single-parent families", () => {
    const a = person("A", "male"), b = person("B", "female"), c = person("C", "male");
    let tree: FamilyTree = { ...newTree(), people: [a, b, c] };
    tree = addRelationship(tree, "partner", a.id, b.id, { status: "partner" });
    tree = addRelationship(tree, "parent-child", a.id, c.id, { kind: "biological" });
    tree = addRelationship(tree, "parent-child", b.id, c.id, { kind: "step" });
    const text = exportGedcom(tree, on);
    expect(text).toContain("1 _UMAR Y");
    expect(text).toContain("2 _HERITG_KIND step");
    const back = importGedcom(text);
    const kinds = back.relationships.filter(r => r.type === "parent-child").map(r => r.kind).sort();
    expect(kinds).toEqual(["biological", "step"]);
    expect(back.relationships.find(r => r.type === "partner")?.status).toBe("partner");
  });
});

describe("importGedcom", () => {
  it("round-trips the example tree", () => {
    const original = createJokowiDemoTree();
    const back = importGedcom(exportGedcom(original, on));
    const names = (t: FamilyTree) => new Map(t.people.map(p => [p.id, p]));
    expect(back.people.length).toBe(original.people.length);
    const sig = (t: FamilyTree) => t.people.map(p => `${p.name}|${p.gender}|${p.birthDate}|${p.deathDate}|${p.birthOrder}|${p.residence}|${p.notes}`).sort();
    expect(sig(back)).toEqual(sig(original));
    const rels = (t: FamilyTree) => { const by = names(t); return t.relationships.map(r => `${r.type}|${by.get(r.from)!.name}|${by.get(r.to)!.name}|${r.kind}|${r.status}|${r.marriedOn}`).sort(); };
    const norm = (list: string[]) => list.map(s => { const [type, a, b, ...rest] = s.split("|"); return type === "partner" ? [type, ...[a, b].sort(), ...rest].join("|") : s; }).sort();
    expect(norm(rels(back))).toEqual(norm(rels(original)));
    expect(back.id).not.toBe(original.id);
    expect(back.people.some(p => original.people.some(o => o.id === p.id))).toBe(false);
  });

  it("keeps ex status, marriage date and kinds in a round trip", () => {
    const a = person("A", "male"), b = person("B", "female"), c = person("C", "female");
    let tree: FamilyTree = { ...newTree(), people: [a, b, c] };
    tree = addRelationship(tree, "partner", a.id, b.id, { status: "ex", marriedOn: "2001-02-03" });
    tree = addRelationship(tree, "parent-child", a.id, c.id, { kind: "guardian" });
    const back = importGedcom(exportGedcom(tree, on));
    expect(back.relationships.find(r => r.type === "partner")).toMatchObject({ status: "ex", marriedOn: "2001-02-03" });
    expect(back.relationships.find(r => r.type === "parent-child")?.kind).toBe("guardian");
  });

  it("reads a GEDCOM written by another app", () => {
    const text = [
      "\uFEFF0 HEAD", "1 SOUR OtherApp", "2 VERS 9", "1 FILE C:\\docs\\Keluarga Lain.ged", "1 CHAR UTF-8",
      "0 @I1@ INDI", "1 NAME Joko /Widodo/", "2 GIVN Joko", "2 SURN Widodo", "1 SEX M", "1 BIRT", "2 DATE ABT 1950", "2 PLAC Solo", "1 _MILT Y", "1 FAMS @F1@",
      "0 @I2@ INDI", "1 NAME Iriana //", "1 SEX F", "1 BIRT", "2 DATE JUN 1952", "1 FAMS @F1@",
      "0 @I3@ INDI", "1 NAME", "2 GIVN Gibran", "2 SURN Raka", "1 SEX M", "1 DEAT", "2 DATE BEF 2030", "1 FAMC @F1@", "2 PEDI adopted",
      "0 @I4@ INDI", "1 NAME Kaesang /P/", "1 FAMC @F1@",
      "0 @F1@ FAM", "1 HUSB @I1@", "1 WIFE @I2@", "1 MARR", "2 DATE 24 DEC 1986", "1 CHIL @I3@", "1 CHIL @I4@", "1 CHIL @I99@", "1 UNKNOWN thing",
      "0 TRLR",
    ].join("\n");
    const tree = importGedcom(text);
    expect(tree.name).toBe("Keluarga Lain");
    expect(tree.people.map(p => p.name)).toEqual(["Joko Widodo", "Iriana", "Gibran Raka", "Kaesang P"]);
    expect(tree.people[0]).toMatchObject({ gender: "male", birthDate: "1950-01-01", residence: "" });
    expect(tree.people[1].birthDate).toBe("1952-06-01");
    expect(tree.people[2].deathDate).toBe("2030-01-01");
    const partner = tree.relationships.find(r => r.type === "partner");
    expect(partner).toMatchObject({ status: "married", marriedOn: "1986-12-24" });
    const kinds = tree.relationships.filter(r => r.type === "parent-child").map(r => r.kind);
    expect(kinds).toHaveLength(4);
    expect(kinds.filter(k => k === "adoptive")).toHaveLength(2);
    expect(kinds.filter(k => k === "biological")).toHaveLength(2);
  });

  it("rejects input that is not GEDCOM", () => {
    expect(() => importGedcom("{\"version\":2}")).toThrow("File ini bukan GEDCOM yang valid");
    expect(() => importGedcom("0 HEAD\n0 TRLR")).toThrow("File ini bukan GEDCOM yang valid");
    expect(() => importGedcom("0 @I1@ INDI\n1 NAME A\n0 TRLR")).toThrow("File ini bukan GEDCOM yang valid");
  });

  it("detects GEDCOM text", () => {
    expect(looksLikeGedcom("0 HEAD\r\n1 SOUR X")).toBe(true);
    expect(looksLikeGedcom("{\"version\":2}")).toBe(false);
  });
});
