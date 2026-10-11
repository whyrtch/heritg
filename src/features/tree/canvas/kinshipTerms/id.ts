import type { KinshipTable } from "../kinship";

/** Bahasa Indonesia (casual). "tiri" covers both step and half relatives, as in everyday Indonesian. */
export const id: KinshipTable = {
  terms: {
    self: "Orang terpilih",
    father: "Ayah", mother: "Ibu", parent: "Orang tua",
    grandfather: "Kakek", grandmother: "Nenek", grandparent: "Kakek/Nenek",
    greatGrandfather: "Kakek buyut", greatGrandmother: "Nenek buyut", greatGrandparent: "Buyut",
    greatGreatGrandparent: "Canggah", ancestor: "Leluhur",
    son: "Putra", daughter: "Putri", child: "Anak",
    grandson: "Cucu laki-laki", granddaughter: "Cucu perempuan", grandchild: "Cucu",
    greatGrandson: "Cicit laki-laki", greatGranddaughter: "Cicit perempuan", greatGrandchild: "Cicit",
    greatGreatGrandchild: "Canggah", descendant: "Keturunan",
    husband: "Suami", wife: "Istri", spouse: "Suami/Istri", partner: "Pasangan",
    exHusband: "Mantan suami", exWife: "Mantan istri", exSpouse: "Mantan pasangan",
    brother: "Saudara laki-laki", sister: "Saudara perempuan", sibling: "Saudara",
    olderBrother: "Kakak laki-laki", olderSister: "Kakak perempuan", olderSibling: "Kakak",
    youngerBrother: "Adik laki-laki", youngerSister: "Adik perempuan", youngerSibling: "Adik",
    uncle: "Paman", aunt: "Bibi", uncleAunt: "Paman/Bibi",
    olderUncle: "Pakde", olderAunt: "Bude", olderUncleAunt: "Pakde/Bude",
    youngerUncle: "Om", youngerAunt: "Tante", youngerUncleAunt: "Om/Tante",
    grandUncle: "Kakek paman", grandAunt: "Nenek bibi", grandUncleAunt: "Saudara kakek/nenek",
    nephew: "Keponakan laki-laki", niece: "Keponakan perempuan", nibling: "Keponakan", grandNibling: "Cucu keponakan",
    cousin: "Sepupu", secondCousin: "Sepupu dua kali", distantCousin: "Sepupu jauh",
    fatherInLaw: "Bapak mertua", motherInLaw: "Ibu mertua", parentInLaw: "Mertua",
    sonInLaw: "Menantu laki-laki", daughterInLaw: "Menantu perempuan", childInLaw: "Menantu",
    brotherInLaw: "Ipar laki-laki", sisterInLaw: "Ipar perempuan", siblingInLaw: "Ipar",
    guardian: "Wali", ward: "Anak perwalian",
    inLawRelative: "Keluarga ipar", relative: "Kerabat"
  },
  modifiers: { step: "{} tiri", adoptive: "{} angkat", foster: "{} asuh", half: "{} tiri" },
  overrides: { "child:step": "Anak tiri" }
};
