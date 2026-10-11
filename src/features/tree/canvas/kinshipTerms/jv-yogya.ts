import type { KinshipTable } from "../kinship";

/** Basa Jawa, Yogyakarta usage (ngoko-leaning, with common krama terms for elders). */
export const jvYogya: KinshipTable = {
  terms: {
    self: "Wong sing dipilih",
    father: "Bapak", mother: "Ibu", parent: "Wong tuwa",
    grandfather: "Simbah kakung", grandmother: "Simbah putri", grandparent: "Simbah",
    greatGrandfather: "Mbah buyut", greatGrandmother: "Mbah buyut", greatGrandparent: "Mbah buyut",
    greatGreatGrandparent: "Mbah canggah", ancestor: "Leluhur",
    son: "Putra", daughter: "Putri", child: "Anak",
    grandson: "Putu lanang", granddaughter: "Putu wadon", grandchild: "Putu",
    greatGrandson: "Buyut", greatGranddaughter: "Buyut", greatGrandchild: "Buyut",
    greatGreatGrandchild: "Canggah", descendant: "Turunan",
    husband: "Garwa kakung", wife: "Garwa putri", spouse: "Garwa", partner: "Pasangan",
    exHusband: "Mantan garwa kakung", exWife: "Mantan garwa putri", exSpouse: "Mantan garwa",
    brother: "Sedulur lanang", sister: "Sedulur wadon", sibling: "Sedulur",
    olderBrother: "Mas", olderSister: "Mbak", olderSibling: "Mas/Mbak",
    youngerBrother: "Adhik lanang", youngerSister: "Adhik wadon", youngerSibling: "Adhik",
    uncle: "Paman", aunt: "Bibi", uncleAunt: "Paman/Bibi",
    olderUncle: "Pakdhe", olderAunt: "Budhe", olderUncleAunt: "Pakdhe/Budhe",
    youngerUncle: "Paklik", youngerAunt: "Bulik", youngerUncleAunt: "Paklik/Bulik",
    grandUncle: "Simbah paman", grandAunt: "Simbah bibi", grandUncleAunt: "Simbah (sedulur)",
    nephew: "Ponakan lanang", niece: "Ponakan wadon", nibling: "Ponakan", grandNibling: "Putu ponakan",
    cousin: "Sedulur misan", secondCousin: "Sedulur mindhoan", distantCousin: "Sedulur tebih",
    fatherInLaw: "Maratuwa kakung", motherInLaw: "Maratuwa putri", parentInLaw: "Maratuwa",
    sonInLaw: "Mantu lanang", daughterInLaw: "Mantu wadon", childInLaw: "Mantu",
    brotherInLaw: "Ipe lanang", sisterInLaw: "Ipe wadon", siblingInLaw: "Ipe",
    guardian: "Wali", ward: "Anak perwalian",
    inLawRelative: "Sedulur ipe", relative: "Sedulur"
  },
  modifiers: { step: "{} tiri", adoptive: "{} angkat", foster: "{} asuh", half: "{} tiri" },
  overrides: { "child:step": "Anak tiri" }
};
