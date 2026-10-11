import { describe, expect, it } from "vitest";
import { createJokowiDemoTree } from "../demoData";
import type { FamilyTree, Gender, ParentKind, PartnerStatus, Person, Relationship } from "../model";
import { describeKinship, kinshipLabel, kinshipLabels, type KinshipDialect } from "./kinship";
import { KINSHIP_DIALECTS, KINSHIP_TERMS } from "./kinshipTerms";

const person = (id: string, gender: Gender, birthDate = "", birthOrder: number | null = null): Person => ({
  id, name: id, gender, birthDate, deathDate: "", birthOrder, residence: "", notes: "", photoUrl: "", photo: ""
});
let counter = 0;
const parentOf = (from: string, to: string, kind: ParentKind = "biological"): Relationship => ({ id: `r${counter++}`, type: "parent-child", from, to, kind, status: null, marriedOn: "" });
const partnerOf = (from: string, to: string, status: PartnerStatus = "married"): Relationship => ({ id: `r${counter++}`, type: "partner", from, to, kind: null, status, marriedOn: "" });
const treeOf = (people: Person[], relationships: Relationship[]): FamilyTree => ({ id: "t", name: "t", people, relationships, updatedAt: "" });

/** A fictional 5-generation family. Everything below is seen from "dewi". */
function fixture(): FamilyTree {
  const people = [
    person("dewi", "female", "1988-05-01"),
    person("ayah", "male", "1960-01-01"), person("ibu", "female", "1963-01-01"),
    person("kakek", "male", "1930-01-01"), person("nenek", "female", "1934-01-01"),
    person("kakekIbu", "male", "1932-01-01"), person("nenekIbu", "female", "1936-01-01"),
    person("buyut", "male", "1900-01-01"), person("canggah", "unspecified"), person("leluhur", "male"),
    person("pakde", "male", "1955-01-01"), person("paklik", "male", "1970-01-01"), person("bibi", "female", "1968-01-01"),
    person("budhe", "female", "1957-01-01"), person("sari", "female", "1985-01-01"),
    person("grandUncle", "male", "1928-01-01"), person("pamanJauh", "female"), person("sepupuDua", "male"),
    person("rian", "male", "1985-01-01"), person("tika", "female", "1992-01-01"), person("kai", "unspecified"),
    person("maya", "female"), person("nando", "male"), person("nisa", "female"), person("oka", "female"),
    person("lina", "female"), person("hana", "female", "1995-01-01"),
    person("bambang", "male"), person("joni", "male", "1986-01-01"),
    person("wali", "male"),
    person("eko", "male"), person("pakSurya", "male"), person("buSurya", "female"), person("fajar", "male"),
    person("bima", "male"), person("zee", "unspecified"),
    person("naya", "female"), person("dimas", "male"), person("rafi", "male"), person("lia", "female"),
    person("cici", "female"), person("dodi", "male"), person("eka", "male"), person("fufu", "female"), person("gigi", "male"),
    person("hadi", "male"), person("gani", "male"), person("yuri", "unspecified"), person("zen", "unspecified"),
    person("orangAsing", "female")
  ];
  const relationships = [
    partnerOf("kakek", "nenek"), partnerOf("kakekIbu", "nenekIbu"),
    parentOf("buyut", "kakek"), parentOf("canggah", "buyut"), parentOf("leluhur", "canggah"),
    parentOf("buyut", "grandUncle"), parentOf("grandUncle", "pamanJauh"), parentOf("pamanJauh", "sepupuDua"),
    ...["pakde", "paklik", "bibi", "ayah"].flatMap(id => [parentOf("kakek", id), parentOf("nenek", id)]),
    partnerOf("pakde", "budhe"), parentOf("pakde", "sari"), parentOf("budhe", "sari"),
    parentOf("kakekIbu", "ibu"), parentOf("nenekIbu", "ibu"),
    partnerOf("ayah", "ibu"),
    ...["dewi", "rian", "tika", "kai"].flatMap(id => [parentOf("ayah", id), parentOf("ibu", id)]),
    partnerOf("ayah", "lina", "ex"), parentOf("ayah", "hana"), parentOf("lina", "hana"),
    partnerOf("ibu", "bambang", "partner"), parentOf("bambang", "joni"),
    parentOf("wali", "kai", "guardian"),
    partnerOf("rian", "maya"), parentOf("rian", "nando"), parentOf("maya", "nando"), parentOf("tika", "nisa"), parentOf("nando", "oka"),
    partnerOf("dewi", "eko"), parentOf("pakSurya", "eko"), parentOf("buSurya", "eko"), parentOf("pakSurya", "fajar"), parentOf("buSurya", "fajar"),
    parentOf("eko", "bima"), parentOf("eko", "zee"),
    parentOf("dewi", "naya"), parentOf("eko", "naya"), parentOf("dewi", "dimas"), parentOf("eko", "dimas"),
    parentOf("dewi", "rafi", "adoptive"), parentOf("dewi", "lia", "foster"),
    parentOf("naya", "cici"), parentOf("dimas", "dodi"), parentOf("cici", "eka"), parentOf("eka", "fufu"), parentOf("fufu", "gigi"),
    partnerOf("dewi", "hadi", "partner"), partnerOf("dewi", "gani", "ex"), partnerOf("dewi", "yuri", "ex"), partnerOf("dewi", "zen")
  ];
  return treeOf(people, relationships);
}

// [person, id, jv-yogya, ms, en] — as seen from "dewi".
const FROM_DEWI: [string, string, string, string, string][] = [
  ["dewi", "Orang terpilih", "Wong sing dipilih", "Orang terpilih", "Selected person"],
  ["ayah", "Ayah", "Bapak", "Bapa", "Father"],
  ["ibu", "Ibu", "Ibu", "Emak", "Mother"],
  ["kakek", "Kakek", "Simbah kakung", "Datuk", "Grandfather"],
  ["nenek", "Nenek", "Simbah putri", "Nenek", "Grandmother"],
  ["kakekIbu", "Kakek", "Simbah kakung", "Datuk", "Grandfather"],
  ["buyut", "Kakek buyut", "Mbah buyut", "Moyang", "Great-grandfather"],
  ["canggah", "Canggah", "Mbah canggah", "Piut", "Great-great-grandparent"],
  ["leluhur", "Leluhur", "Leluhur", "Nenek moyang", "Ancestor"],
  ["pakde", "Pakde", "Pakdhe", "Bapa saudara", "Uncle"],
  ["paklik", "Om", "Paklik", "Bapa saudara", "Uncle"],
  ["bibi", "Tante", "Bulik", "Mak saudara", "Aunt"],
  ["budhe", "Bude", "Budhe", "Mak saudara", "Aunt"],
  ["grandUncle", "Kakek paman", "Simbah paman", "Datuk saudara", "Great-uncle"],
  ["sari", "Sepupu", "Sedulur misan", "Sepupu", "Cousin"],
  ["sepupuDua", "Sepupu dua kali", "Sedulur mindhoan", "Sepupu dua kali", "Second cousin"],
  ["pamanJauh", "Kerabat", "Sedulur", "Saudara-mara", "Relative"],
  ["rian", "Kakak laki-laki", "Mas", "Abang", "Brother"],
  ["tika", "Adik perempuan", "Adhik wadon", "Adik perempuan", "Sister"],
  ["kai", "Saudara", "Sedulur", "Adik-beradik", "Sibling"],
  ["hana", "Adik perempuan tiri", "Adhik wadon tiri", "Adik perempuan tiri", "Half-sister"],
  ["joni", "Kakak laki-laki tiri", "Mas tiri", "Abang tiri", "Stepbrother"],
  ["bambang", "Ayah tiri", "Bapak tiri", "Bapa tiri", "Stepfather"],
  ["maya", "Ipar perempuan", "Ipe wadon", "Ipar perempuan", "Sister-in-law"],
  ["nando", "Keponakan laki-laki", "Ponakan lanang", "Anak saudara lelaki", "Nephew"],
  ["nisa", "Keponakan perempuan", "Ponakan wadon", "Anak saudara perempuan", "Niece"],
  ["oka", "Cucu keponakan", "Putu ponakan", "Cucu saudara", "Great-niece/nephew"],
  ["eko", "Suami", "Garwa kakung", "Suami", "Husband"],
  ["pakSurya", "Bapak mertua", "Maratuwa kakung", "Bapa mentua", "Father-in-law"],
  ["buSurya", "Ibu mertua", "Maratuwa putri", "Emak mentua", "Mother-in-law"],
  ["fajar", "Ipar laki-laki", "Ipe lanang", "Ipar lelaki", "Brother-in-law"],
  ["bima", "Putra tiri", "Putra tiri", "Anak lelaki tiri", "Stepson"],
  ["zee", "Anak tiri", "Anak tiri", "Anak tiri", "Stepchild"],
  ["naya", "Putri", "Putri", "Anak perempuan", "Daughter"],
  ["dimas", "Putra", "Putra", "Anak lelaki", "Son"],
  ["rafi", "Putra angkat", "Putra angkat", "Anak lelaki angkat", "Adoptive son"],
  ["lia", "Putri asuh", "Putri asuh", "Anak perempuan asuh", "Foster daughter"],
  ["cici", "Cucu perempuan", "Putu wadon", "Cucu perempuan", "Granddaughter"],
  ["dodi", "Cucu laki-laki", "Putu lanang", "Cucu lelaki", "Grandson"],
  ["eka", "Cicit laki-laki", "Buyut", "Cicit lelaki", "Great-grandson"],
  ["fufu", "Canggah", "Canggah", "Piut", "Great-great-grandchild"],
  ["gigi", "Keturunan", "Turunan", "Keturunan", "Descendant"],
  ["hadi", "Pasangan", "Pasangan", "Pasangan", "Partner"],
  ["gani", "Mantan suami", "Mantan garwa kakung", "Bekas suami", "Ex-husband"],
  ["yuri", "Mantan pasangan", "Mantan garwa", "Bekas pasangan", "Ex-spouse"],
  ["zen", "Suami/Istri", "Garwa", "Suami/Isteri", "Spouse"],
  ["orangAsing", "", "", "", ""]
];

describe("kinshipLabel on the fixture family (seen from dewi)", () => {
  const tree = fixture();
  const dialects: KinshipDialect[] = ["id", "jv-yogya", "ms", "en"];
  dialects.forEach((dialect, column) => {
    it(`labels every relative in ${dialect}`, () => {
      for (const row of FROM_DEWI) expect(kinshipLabel(tree, "dewi", row[0], dialect), `${row[0]} (${dialect})`).toBe(row[column + 1]);
    });
  });

  it("defaults to Indonesian", () => {
    expect(kinshipLabel(tree, "dewi", "ayah")).toBe("Ayah");
  });

  it("kinshipLabels returns exactly the same strings as kinshipLabel for everyone", () => {
    for (const dialect of dialects) {
      const labels = kinshipLabels(tree, "dewi", dialect);
      expect(labels.size).toBe(tree.people.length);
      for (const p of tree.people) expect(labels.get(p.id)).toBe(kinshipLabel(tree, "dewi", p.id, dialect));
    }
  });

  it("is deterministic", () => {
    expect([...kinshipLabels(tree, "dewi")]).toEqual([...kinshipLabels(fixture(), "dewi")]);
  });

  it("returns structured results with flags", () => {
    expect(describeKinship(tree, "dewi", "ayah")).toEqual({ key: "father" });
    expect(describeKinship(tree, "dewi", "hana")).toEqual({ key: "youngerSister", half: true });
    expect(describeKinship(tree, "dewi", "joni")).toEqual({ key: "olderBrother", step: true });
    expect(describeKinship(tree, "dewi", "rafi")).toEqual({ key: "son", adoptive: true });
    expect(describeKinship(tree, "dewi", "lia")).toEqual({ key: "daughter", foster: true });
    expect(describeKinship(tree, "dewi", "bambang")).toEqual({ key: "father", step: true });
    expect(describeKinship(tree, "dewi", "orangAsing")).toBeNull();
    expect(describeKinship(tree, "dewi", "nobody")).toBeNull();
    expect(describeKinship(tree, "nobody", "dewi")).toBeNull();
  });
});

describe("other viewpoints", () => {
  const tree = fixture();
  it("adoptive and foster parents", () => {
    expect(kinshipLabel(tree, "rafi", "dewi")).toBe("Ibu angkat");
    expect(kinshipLabel(tree, "lia", "dewi")).toBe("Ibu asuh");
    expect(kinshipLabel(tree, "rafi", "dewi", "en")).toBe("Adoptive mother");
    expect(kinshipLabel(tree, "lia", "dewi", "ms")).toBe("Emak asuh");
  });
  it("guardian and ward", () => {
    expect(kinshipLabel(tree, "kai", "wali")).toBe("Wali");
    expect(kinshipLabel(tree, "wali", "kai")).toBe("Anak perwalian");
    expect(kinshipLabel(tree, "kai", "wali", "en")).toBe("Guardian");
  });
  it("wife, children-in-law and parents-in-law from the spouse's side", () => {
    expect(kinshipLabel(tree, "eko", "dewi")).toBe("Istri");
    expect(kinshipLabel(tree, "eko", "dewi", "jv-yogya")).toBe("Garwa putri");
    expect(kinshipLabel(tree, "eko", "dewi", "ms")).toBe("Isteri");
    expect(kinshipLabel(tree, "eko", "dewi", "en")).toBe("Wife");
    expect(kinshipLabel(tree, "eko", "ayah")).toBe("Bapak mertua");
    expect(kinshipLabel(tree, "eko", "ibu")).toBe("Ibu mertua");
    expect(kinshipLabel(tree, "eko", "rian")).toBe("Ipar laki-laki");
    expect(kinshipLabel(tree, "ayah", "eko")).toBe("Menantu laki-laki");
    expect(kinshipLabel(tree, "ayah", "eko", "jv-yogya")).toBe("Mantu lanang");
    expect(kinshipLabel(tree, "ayah", "eko", "ms")).toBe("Menantu lelaki");
    expect(kinshipLabel(tree, "ayah", "eko", "en")).toBe("Son-in-law");
    expect(kinshipLabel(tree, "pakSurya", "dewi")).toBe("Menantu perempuan");
    expect(kinshipLabel(tree, "pakSurya", "dewi", "en")).toBe("Daughter-in-law");
  });
  it("uncle seen from the nephew is a sibling seen from the parent", () => {
    expect(kinshipLabel(tree, "ayah", "pakde")).toBe("Kakak laki-laki");
    expect(kinshipLabel(tree, "ayah", "bibi")).toBe("Adik perempuan");
    expect(kinshipLabel(tree, "pakde", "dewi")).toBe("Keponakan perempuan");
  });
  it("a parent's ex-partner is not a relative", () => {
    expect(kinshipLabel(tree, "dewi", "lina")).toBe("");
    expect(kinshipLabel(tree, "ayah", "lina")).toBe("Mantan istri");
    expect(kinshipLabel(tree, "ayah", "hana")).toBe("Putri");
  });
});

describe("neutral fallbacks for unspecified gender", () => {
  const tree = treeOf(
    [person("me", "male"), person("par", "unspecified"), person("gp", "unspecified"), person("sib", "unspecified"), person("unc", "unspecified"),
      person("kid", "unspecified"), person("gkid", "unspecified"), person("sp", "unspecified"), person("pil", "unspecified"),
      person("cil", "unspecified"), person("sil", "unspecified"), person("nib", "unspecified"), person("cuz", "unspecified")],
    [parentOf("par", "me"), parentOf("gp", "par"), parentOf("par", "sib"), parentOf("gp", "unc"), parentOf("me", "kid"), parentOf("kid", "gkid"),
      partnerOf("me", "sp"), partnerOf("sp", "pil"), parentOf("pil", "sp"), partnerOf("kid", "cil"), partnerOf("sib", "sil"), parentOf("sib", "nib"),
      parentOf("unc", "cuz")]
  );
  it("uses the neutral key and term", () => {
    const key = (id: string) => describeKinship(tree, "me", id)?.key;
    expect(key("par")).toBe("parent");
    expect(key("gp")).toBe("grandparent");
    expect(key("sib")).toBe("sibling");
    expect(key("unc")).toBe("uncleAunt");
    expect(key("kid")).toBe("child");
    expect(key("gkid")).toBe("grandchild");
    expect(key("sp")).toBe("spouse");
    expect(key("cil")).toBe("childInLaw");
    expect(key("nib")).toBe("nibling");
    expect(key("cuz")).toBe("cousin");
    expect(kinshipLabel(tree, "me", "par")).toBe("Orang tua");
    expect(kinshipLabel(tree, "me", "kid")).toBe("Anak");
    expect(kinshipLabel(tree, "me", "unc")).toBe("Paman/Bibi");
    expect(kinshipLabel(tree, "me", "cil")).toBe("Menantu");
    expect(kinshipLabel(tree, "me", "kid", "en")).toBe("Child");
  });
  it("sibling-in-law and parent-in-law are neutral too", () => {
    const t = treeOf(
      [person("me", "female"), person("sp", "male"), person("pil", "unspecified"), person("sibl", "unspecified")],
      [partnerOf("me", "sp"), parentOf("pil", "sp"), parentOf("pil", "sibl")]
    );
    expect(describeKinship(t, "me", "pil")?.key).toBe("parentInLaw");
    expect(kinshipLabel(t, "me", "pil")).toBe("Mertua");
    expect(kinshipLabel(t, "me", "pil", "jv-yogya")).toBe("Maratuwa");
    expect(kinshipLabel(t, "me", "pil", "ms")).toBe("Mentua");
    expect(kinshipLabel(t, "me", "sibl")).toBe("Ipar");
  });
});

describe("older / younger", () => {
  const sibs = (a: Partial<Person>, b: Partial<Person>) =>
    treeOf([{ ...person("a", "male"), ...a }, { ...person("b", "female"), ...b }, person("p", "male")], [parentOf("p", "a"), parentOf("p", "b")]);
  it("uses birthOrder when dates are missing", () => {
    const t = sibs({ birthOrder: 1 }, { birthOrder: 2 });
    expect(kinshipLabel(t, "b", "a")).toBe("Kakak laki-laki");
    expect(kinshipLabel(t, "a", "b")).toBe("Adik perempuan");
  });
  it("uses birth dates when birthOrder is missing", () => {
    const t = sibs({ birthDate: "1990-01-01" }, { birthDate: "1980-01-01" });
    expect(kinshipLabel(t, "a", "b")).toBe("Kakak perempuan");
    expect(kinshipLabel(t, "b", "a")).toBe("Adik laki-laki");
  });
  it("falls back to the plain term when nothing is known", () => {
    const t = sibs({}, {});
    expect(kinshipLabel(t, "a", "b")).toBe("Saudara perempuan");
    expect(kinshipLabel(t, "a", "b", "en")).toBe("Sister");
  });
  it("splits uncles by comparing with the parent", () => {
    const t = treeOf(
      [person("me", "male"), person("dad", "male", "1960-01-01"), person("gp", "female"), person("elder", "male", "1955-01-01"), person("younger", "female", "1965-01-01")],
      [parentOf("dad", "me"), parentOf("gp", "dad"), parentOf("gp", "elder"), parentOf("gp", "younger")]
    );
    expect(kinshipLabel(t, "me", "elder")).toBe("Pakde");
    expect(kinshipLabel(t, "me", "elder", "jv-yogya")).toBe("Pakdhe");
    expect(kinshipLabel(t, "me", "younger")).toBe("Tante");
    expect(kinshipLabel(t, "me", "younger", "jv-yogya")).toBe("Bulik");
  });
});

describe("robustness", () => {
  it("survives a parent-child cycle and dangling relationships", () => {
    const t = treeOf([person("a", "male"), person("b", "female")], [parentOf("a", "b"), parentOf("b", "a"), parentOf("a", "ghost"), partnerOf("a", "a")]);
    expect(() => kinshipLabels(t, "a")).not.toThrow();
    expect(kinshipLabel(t, "a", "b")).not.toBeUndefined();
  });
  it("handles 500 people quickly", () => {
    const people = Array.from({ length: 500 }, (_, i) => person(`p${i}`, i % 3 === 0 ? "female" : i % 3 === 1 ? "male" : "unspecified"));
    const rels: Relationship[] = [];
    for (let i = 1; i < 500; i += 1) rels.push(parentOf(`p${Math.floor((i - 1) / 2)}`, `p${i}`));
    for (let i = 0; i < 250; i += 25) rels.push(partnerOf(`p${i}`, `p${499 - i}`));
    const t = treeOf(people, rels);
    const start = performance.now();
    const labels = kinshipLabels(t, "p499");
    const elapsed = performance.now() - start;
    expect(labels.size).toBe(500);
    expect(labels.get("p499")).toBe("Orang terpilih");
    expect(elapsed).toBeLessThan(1500);
  });
});

describe("term tables", () => {
  it("define every key in every dialect, and the modifier templates", () => {
    for (const dialect of KINSHIP_DIALECTS) {
      const table = KINSHIP_TERMS[dialect];
      for (const [key, value] of Object.entries(table.terms)) expect(value, `${dialect}.${key}`).toBeTruthy();
      for (const [modifier, template] of Object.entries(table.modifiers)) expect(template, `${dialect}.${modifier}`).toContain("{");
    }
  });
});

describe("Joko Widodo demo tree", () => {
  const tree = createJokowiDemoTree();
  it("labels the demo family", () => {
    expect(kinshipLabel(tree, "jokowi", "iriana")).toBe("Istri");
    expect(kinshipLabel(tree, "jokowi", "gibran")).toBe("Putra");
    expect(kinshipLabel(tree, "jokowi", "kahiyang")).toBe("Putri");
    expect(kinshipLabel(tree, "jokowi", "widjiatno")).toBe("Ayah");
    expect(kinshipLabel(tree, "jokowi", "lamidi")).toBe("Kakek");
    expect(kinshipLabel(tree, "jokowi", "selvi")).toBe("Menantu perempuan");
    expect(kinshipLabel(tree, "jokowi", "bobby")).toBe("Menantu laki-laki");
    expect(kinshipLabel(tree, "jokowi", "jan-ethes")).toBe("Cucu laki-laki");
    expect(kinshipLabel(tree, "gibran", "kahiyang")).toBe("Adik perempuan");
    expect(kinshipLabel(tree, "gibran", "kaesang")).toBe("Adik laki-laki");
    expect(kinshipLabel(tree, "gibran", "bobby")).toBe("Ipar laki-laki");
    expect(kinshipLabel(tree, "gibran", "lamidi")).toBe("Kakek buyut");
    expect(kinshipLabel(tree, "gibran", "sedah-mirah")).toBe("Keponakan perempuan");
    expect(kinshipLabel(tree, "jan-ethes", "sedah-mirah")).toBe("Sepupu");
  });
});
