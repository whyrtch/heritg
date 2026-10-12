import type { KinshipTable } from "../kinship";

/** Bahasa Melayu (Malaysia / Brunei). */
export const ms: KinshipTable = {
  terms: {
    self: "Orang terpilih",
    father: "Bapa", mother: "Emak", parent: "Ibu bapa",
    grandfather: "Datuk", grandmother: "Nenek", grandparent: "Datuk/Nenek",
    greatGrandfather: "Moyang", greatGrandmother: "Moyang", greatGrandparent: "Moyang",
    greatGreatGrandparent: "Piut", ancestor: "Nenek moyang",
    son: "Anak lelaki", daughter: "Anak perempuan", child: "Anak",
    grandson: "Cucu lelaki", granddaughter: "Cucu perempuan", grandchild: "Cucu",
    greatGrandson: "Cicit lelaki", greatGranddaughter: "Cicit perempuan", greatGrandchild: "Cicit",
    greatGreatGrandchild: "Piut", descendant: "Keturunan",
    husband: "Suami", wife: "Isteri", spouse: "Suami/Isteri", partner: "Pasangan",
    exHusband: "Bekas suami", exWife: "Bekas isteri", exSpouse: "Bekas pasangan",
    brother: "Saudara lelaki", sister: "Saudara perempuan", sibling: "Adik-beradik",
    olderBrother: "Abang", olderSister: "Kakak", olderSibling: "Abang/Kakak",
    youngerBrother: "Adik lelaki", youngerSister: "Adik perempuan", youngerSibling: "Adik",
    uncle: "Bapa saudara", aunt: "Mak saudara", uncleAunt: "Bapa/Mak saudara",
    olderUncle: "Bapa saudara", olderAunt: "Mak saudara", olderUncleAunt: "Bapa/Mak saudara",
    youngerUncle: "Bapa saudara", youngerAunt: "Mak saudara", youngerUncleAunt: "Bapa/Mak saudara",
    grandUncle: "Datuk saudara", grandAunt: "Nenek saudara", grandUncleAunt: "Datuk/Nenek saudara",
    nephew: "Anak saudara lelaki", niece: "Anak saudara perempuan", nibling: "Anak saudara", grandNibling: "Cucu saudara",
    cousin: "Sepupu", secondCousin: "Sepupu dua kali", distantCousin: "Sepupu jauh",
    fatherInLaw: "Bapa mentua", motherInLaw: "Emak mentua", parentInLaw: "Mentua",
    sonInLaw: "Menantu lelaki", daughterInLaw: "Menantu perempuan", childInLaw: "Menantu",
    brotherInLaw: "Ipar lelaki", sisterInLaw: "Ipar perempuan", siblingInLaw: "Ipar",
    guardian: "Wali", ward: "Anak jagaan",
    inLawRelative: "Saudara ipar", relative: "Saudara-mara"
  },
  modifiers: { step: "{} tiri", adoptive: "{} angkat", foster: "{} asuh", half: "{} tiri" },
  overrides: { "child:step": "Anak tiri" }
};
