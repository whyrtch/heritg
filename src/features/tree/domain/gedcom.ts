import { addRelationship, newTree, normalizeTree, PARENT_KINDS, uid, type FamilyTree, type Gender, type ParentKind, type PartnerStatus, type Person } from "../model";

/**
 * GEDCOM 5.5.1 export and import.
 *
 * Mapping choices (export):
 * - Heritg stores one `name`, so it is written as `1 NAME <name> //` (no surname part) with `2 GIVN <name>`; nothing is split or lost.
 * - There is no "deceased" flag in the model, so `DEAT` is written only when there is a death date.
 * - Photos are never written. `_BIRTH_ORDER` is a custom tag (only with the dates option on).
 * - One FAM per partner pair. A child joins the pair's FAM only when both parents link to it with the same kind; otherwise each parent gets a single-parent FAM,
 *   because PEDI belongs to the child's FAMC link and cannot differ per parent inside one FAM.
 * - Partner status: married = `MARR`, ex = `MARR` + `DIV Y`, unmarried partner = `_UMAR Y` (no MARR).
 * - Parent kind: biological = PEDI birth, adoptive = adopted, foster = foster, step = PEDI birth + `_HERITG_KIND step`, guardian = PEDI foster + `_HERITG_KIND guardian`.
 *
 * Import: dates are stored as full ISO (the server requires YYYY-MM-DD), so a partial date (`JUN 1961`, `1961`) or a qualified one (`ABT 1950`, `BEF 1950`, `BET 1950 AND 1960`)
 * fills the missing month/day with 01 and uses the first date. Unknown tags are ignored.
 */

export type GedcomOptions = { dates: boolean; marriageDates: boolean };
export const GEDCOM_INVALID = "File ini bukan GEDCOM yang valid";
const DEFAULT_TREE_NAME = "Silsilah dari GEDCOM";
const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const CHUNK = 200;
const NOTES_MAX = 10000;

// ---------------------------------------------------------------- export

function gedcomDate(iso: string): string {
  const match = /^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?$/.exec(iso);
  if (!match) return "";
  const [, y, m, d] = match;
  const month = m ? MONTHS[Number(m) - 1] : undefined;
  if (!month) return y;
  return d ? `${Number(d)} ${month} ${y}` : `${month} ${y}`;
}

/** Writes `level TAG text`, splitting newlines into CONT and anything over 200 chars into CONC. */
function pushText(out: string[], level: number, tag: string, text: string) {
  text.split(/\r\n|\r|\n/).forEach((line, index) => {
    for (let at = 0, first = true; first || at < line.length; at += CHUNK, first = false) {
      const piece = line.slice(at, at + CHUNK);
      if (index === 0 && at === 0) out.push(`${level} ${tag}${piece ? ` ${piece}` : ""}`);
      else out.push(`${level + 1} ${at === 0 ? "CONT" : "CONC"}${piece ? ` ${piece}` : ""}`);
    }
  });
}

const PEDI: Record<ParentKind, { pedi: string; custom?: ParentKind }> = {
  biological: { pedi: "birth" },
  adoptive: { pedi: "adopted" },
  foster: { pedi: "foster" },
  step: { pedi: "birth", custom: "step" },
  guardian: { pedi: "foster", custom: "guardian" },
};

type Fam = { husb?: string; wife?: string; status: PartnerStatus | null; marriedOn: string; children: { id: string; kind: ParentKind }[] };

export function exportGedcom(tree: FamilyTree, options: GedcomOptions): string {
  const people = new Map(tree.people.map(person => [person.id, person]));
  const indi = new Map(tree.people.map((person, index) => [person.id, `@I${index + 1}@`]));
  const fams = new Map<string, Fam>();
  const famId = new Map<string, string>();
  const slot = (a: string, b: string | null) => {
    const male = (id: string) => people.get(id)?.gender === "male", female = (id: string) => people.get(id)?.gender === "female";
    if (b === null) return female(a) ? { wife: a } : { husb: a };
    if (female(a) && !female(b)) return { husb: b, wife: a };
    if (male(b) && !male(a)) return { husb: b, wife: a };
    return { husb: a, wife: b };
  };
  const ensure = (key: string, init: () => Fam) => { let fam = fams.get(key); if (!fam) { fam = init(); fams.set(key, fam); famId.set(key, `@F${fams.size}@`); } return fam; };
  const pairKey = (a: string, b: string) => [a, b].sort().join("|");

  const partners = tree.relationships.filter(r => r.type === "partner" && indi.has(r.from) && indi.has(r.to) && r.from !== r.to);
  for (const rel of partners) {
    const key = pairKey(rel.from, rel.to);
    if (!fams.has(key)) ensure(key, () => ({ ...slot(rel.from, rel.to), status: rel.status ?? "married", marriedOn: rel.marriedOn, children: [] }));
  }
  const links = new Map<string, { id: string; kind: ParentKind }[]>(); // child -> parents
  for (const rel of tree.relationships) {
    if (rel.type !== "parent-child" || !indi.has(rel.from) || !indi.has(rel.to)) continue;
    links.set(rel.to, [...(links.get(rel.to) ?? []), { id: rel.from, kind: rel.kind ?? "biological" }]);
  }
  const childFams = new Map<string, { fam: string; kind: ParentKind }[]>(); // child -> FAMC entries
  for (const person of tree.people) {
    const parents = links.get(person.id) ?? [];
    const left = new Map(parents.map(parent => [parent.id, parent.kind]));
    const place = (key: string, kind: ParentKind) => {
      ensure(key, () => ({ ...slot(key, null), status: null, marriedOn: "", children: [] })).children.push({ id: person.id, kind });
      childFams.set(person.id, [...(childFams.get(person.id) ?? []), { fam: key, kind }]);
    };
    for (const rel of partners) {
      const a = left.get(rel.from), b = left.get(rel.to);
      if (a && b && a === b) { left.delete(rel.from); left.delete(rel.to); place(pairKey(rel.from, rel.to), a); }
    }
    for (const [parent, kind] of left) {
      const key = `single:${parent}`;
      ensure(key, () => ({ ...slot(parent, null), status: null, marriedOn: "", children: [] }));
      place(key, kind);
    }
  }
  const spouseFams = new Map<string, string[]>();
  for (const [key, fam] of fams) for (const id of [fam.husb, fam.wife]) if (id) spouseFams.set(id, [...(spouseFams.get(id) ?? []), key]);

  const out: string[] = ["0 HEAD", "1 SOUR HERITG", "1 GEDC", "2 VERS 5.5.1", "2 FORM LINEAGE-LINKED", "1 CHAR UTF-8", "1 SUBM @U1@", "0 @U1@ SUBM", "1 NAME Heritg"];
  for (const person of tree.people) {
    out.push(`0 ${indi.get(person.id)} INDI`);
    out.push(`1 NAME ${person.name} //`, `2 GIVN ${person.name}`);
    out.push(`1 SEX ${person.gender === "male" ? "M" : person.gender === "female" ? "F" : "U"}`);
    const born = options.dates ? gedcomDate(person.birthDate) : "", died = options.dates ? gedcomDate(person.deathDate) : "";
    if (born) out.push("1 BIRT", `2 DATE ${born}`);
    if (died) out.push("1 DEAT", `2 DATE ${died}`);
    if (options.dates && person.birthOrder) out.push(`1 _BIRTH_ORDER ${person.birthOrder}`);
    if (person.residence.trim()) out.push("1 RESI", `2 PLAC ${person.residence.trim()}`);
    if (person.notes.trim()) pushText(out, 1, "NOTE", person.notes);
    for (const entry of childFams.get(person.id) ?? []) {
      out.push(`1 FAMC ${famId.get(entry.fam)}`, `2 PEDI ${PEDI[entry.kind].pedi}`);
      if (PEDI[entry.kind].custom) out.push(`2 _HERITG_KIND ${PEDI[entry.kind].custom}`);
    }
    for (const key of spouseFams.get(person.id) ?? []) out.push(`1 FAMS ${famId.get(key)}`);
  }
  for (const [key, fam] of fams) {
    out.push(`0 ${famId.get(key)} FAM`);
    if (fam.husb) out.push(`1 HUSB ${indi.get(fam.husb)}`);
    if (fam.wife) out.push(`1 WIFE ${indi.get(fam.wife)}`);
    if (fam.status === "partner") out.push("1 _UMAR Y");
    else if (fam.status) {
      const date = options.marriageDates ? gedcomDate(fam.marriedOn) : "";
      out.push(date ? "1 MARR" : "1 MARR Y");
      if (date) out.push(`2 DATE ${date}`);
      if (fam.status === "ex") out.push("1 DIV Y");
    }
    for (const child of fam.children) out.push(`1 CHIL ${indi.get(child.id)}`);
  }
  out.push("0 TRLR");
  return out.join("\r\n") + "\r\n";
}

// ---------------------------------------------------------------- import

type GNode = { level: number; xref: string; tag: string; value: string; children: GNode[] };

function parse(text: string): GNode[] {
  const roots: GNode[] = [];
  const stack: GNode[] = [];
  for (const raw of text.replace(/^﻿/, "").split(/\r\n|\r|\n/)) {
    const match = /^\s*(\d+) (?:(@[^@]+@) )?([^\s]+)(?: (.*))?$/.exec(raw);
    if (!match) continue;
    const node: GNode = { level: Number(match[1]), xref: match[2] ?? "", tag: match[3].toUpperCase(), value: match[4] ?? "", children: [] };
    if (node.level === 0) { roots.push(node); stack.length = 0; stack.push(node); continue; }
    while (stack.length && stack[stack.length - 1].level >= node.level) stack.pop();
    const parent = stack[stack.length - 1];
    if (!parent) continue;
    if (node.tag === "CONC" || node.tag === "CONT") { parent.value += (node.tag === "CONT" ? "\n" : "") + node.value; continue; }
    parent.children.push(node);
    stack.push(node);
  }
  return roots;
}

const child = (node: GNode, tag: string) => node.children.find(c => c.tag === tag);
const pad = (n: number) => String(n).padStart(2, "0");

/** Returns a full ISO date or "". Partial and qualified dates fill the gaps with 01 (see the file comment). */
function isoFromGedcom(value: string): string {
  let text = value.trim().toUpperCase().replace(/^(BET\s+)/, "").replace(/\s+(AND|TO)\s+.*$/, "");
  text = text.replace(/^(ABT|ABOUT|BEF|AFT|EST|CAL|FROM|TO|C\.?)\s+/, "").replace(/^\(|\)$/g, "").trim();
  const full = /^(\d{1,2})\s+([A-Z]{3})[A-Z]*\s+(\d{4})$/.exec(text);
  if (full && MONTHS.includes(full[2])) { const day = Number(full[1]); return day >= 1 && day <= 31 ? `${full[3]}-${pad(MONTHS.indexOf(full[2]) + 1)}-${pad(day)}` : `${full[3]}-${pad(MONTHS.indexOf(full[2]) + 1)}-01`; }
  const monthYear = /^([A-Z]{3})[A-Z]*\s+(\d{4})$/.exec(text);
  if (monthYear && MONTHS.includes(monthYear[1])) return `${monthYear[2]}-${pad(MONTHS.indexOf(monthYear[1]) + 1)}-01`;
  const yearOnly = /^(\d{4})$/.exec(text);
  return yearOnly ? `${yearOnly[1]}-01-01` : "";
}

const KIND_FROM_PEDI: Record<string, ParentKind> = { BIRTH: "biological", ADOPTED: "adoptive", FOSTER: "foster", STEP: "step" };
const cleanName = (value: string) => value.replace(/\//g, " ").replace(/\s+/g, " ").trim();

export function importGedcom(text: string): FamilyTree {
  const records = parse(text);
  const head = records.find(r => r.tag === "HEAD");
  const individuals = records.filter(r => r.tag === "INDI" && r.xref);
  if (!head || !individuals.length) throw new Error(GEDCOM_INVALID);

  const ids = new Map<string, string>();
  const people: Person[] = individuals.map(record => {
    const id = uid();
    ids.set(record.xref, id);
    const nameNode = child(record, "NAME");
    const name = cleanName(nameNode?.value ?? "") || cleanName([child(nameNode ?? record, "GIVN")?.value, child(nameNode ?? record, "SURN")?.value].filter(Boolean).join(" "));
    const sex = child(record, "SEX")?.value.trim().toUpperCase();
    const gender: Gender = sex === "M" ? "male" : sex === "F" ? "female" : "unspecified";
    const order = Number.parseInt(child(record, "_BIRTH_ORDER")?.value ?? "", 10);
    const notes = record.children.filter(c => c.tag === "NOTE").map(c => c.value.trim()).filter(Boolean).join("\n").slice(0, NOTES_MAX);
    return {
      id, name, gender,
      birthDate: isoFromGedcom(child(child(record, "BIRT") ?? record, "DATE")?.value ?? ""),
      deathDate: isoFromGedcom(child(child(record, "DEAT") ?? record, "DATE")?.value ?? ""),
      birthOrder: Number.isSafeInteger(order) ? order : null,
      residence: (child(child(record, "RESI") ?? record, "PLAC")?.value ?? "").trim(), notes, photoUrl: "", photo: "",
    };
  });

  // Kind of each child in each family, from the child's own FAMC link.
  const kindOf = new Map<string, ParentKind>(); // `${famXref}|${childXref}`
  for (const record of individuals) for (const famc of record.children.filter(c => c.tag === "FAMC")) {
    const custom = child(famc, "_HERITG_KIND")?.value.trim().toLowerCase() as ParentKind | undefined;
    const pedi = KIND_FROM_PEDI[child(famc, "PEDI")?.value.trim().toUpperCase() ?? ""];
    kindOf.set(`${famc.value.trim()}|${record.xref}`, custom && PARENT_KINDS.includes(custom) ? custom : pedi ?? "biological");
  }

  let tree: FamilyTree = { ...newTree(), people };
  const link = (type: "partner" | "parent-child", from: string, to: string, details: Parameters<typeof addRelationship>[4]) => {
    try { tree = addRelationship(tree, type, from, to, details); } catch { /* duplicate, self or cycle: skip */ }
  };
  for (const fam of records.filter(r => r.tag === "FAM")) {
    const husb = ids.get(child(fam, "HUSB")?.value.trim() ?? ""), wife = ids.get(child(fam, "WIFE")?.value.trim() ?? "");
    if (husb && wife) {
      const status: PartnerStatus = child(fam, "DIV") ? "ex" : child(fam, "_UMAR") && !child(fam, "MARR") ? "partner" : "married";
      const marriedOn = isoFromGedcom(child(child(fam, "MARR") ?? fam, "DATE")?.value ?? "");
      link("partner", husb, wife, { status, marriedOn });
    }
    for (const chil of fam.children.filter(c => c.tag === "CHIL")) {
      const xref = chil.value.trim(), childId = ids.get(xref);
      if (!childId) continue;
      const kind = kindOf.get(`${fam.xref}|${xref}`) ?? "biological";
      for (const parent of [husb, wife]) if (parent) link("parent-child", parent, childId, { kind });
    }
  }
  const fileName = (child(head, "FILE")?.value ?? "").trim().replace(/^.*[\\/]/, "").replace(/\.ged$/i, "").trim();
  return normalizeTree({ ...tree, name: (fileName || DEFAULT_TREE_NAME).slice(0, 120), updatedAt: new Date().toISOString() });
}

export const looksLikeGedcom = (text: string) => /^﻿?\s*0 HEAD\b/.test(text);
