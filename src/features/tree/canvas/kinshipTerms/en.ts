import type { KinshipTable } from "../kinship";

/** English. English does not distinguish older/younger siblings or uncles, so those keys share the base term. */
export const en: KinshipTable = {
  terms: {
    self: "Selected person",
    father: "Father", mother: "Mother", parent: "Parent",
    grandfather: "Grandfather", grandmother: "Grandmother", grandparent: "Grandparent",
    greatGrandfather: "Great-grandfather", greatGrandmother: "Great-grandmother", greatGrandparent: "Great-grandparent",
    greatGreatGrandparent: "Great-great-grandparent", ancestor: "Ancestor",
    son: "Son", daughter: "Daughter", child: "Child",
    grandson: "Grandson", granddaughter: "Granddaughter", grandchild: "Grandchild",
    greatGrandson: "Great-grandson", greatGranddaughter: "Great-granddaughter", greatGrandchild: "Great-grandchild",
    greatGreatGrandchild: "Great-great-grandchild", descendant: "Descendant",
    husband: "Husband", wife: "Wife", spouse: "Spouse", partner: "Partner",
    exHusband: "Ex-husband", exWife: "Ex-wife", exSpouse: "Ex-spouse",
    brother: "Brother", sister: "Sister", sibling: "Sibling",
    olderBrother: "Brother", olderSister: "Sister", olderSibling: "Sibling",
    youngerBrother: "Brother", youngerSister: "Sister", youngerSibling: "Sibling",
    uncle: "Uncle", aunt: "Aunt", uncleAunt: "Uncle/Aunt",
    olderUncle: "Uncle", olderAunt: "Aunt", olderUncleAunt: "Uncle/Aunt",
    youngerUncle: "Uncle", youngerAunt: "Aunt", youngerUncleAunt: "Uncle/Aunt",
    grandUncle: "Great-uncle", grandAunt: "Great-aunt", grandUncleAunt: "Great-uncle/aunt",
    nephew: "Nephew", niece: "Niece", nibling: "Niece/Nephew", grandNibling: "Great-niece/nephew",
    cousin: "Cousin", secondCousin: "Second cousin", distantCousin: "Distant cousin",
    fatherInLaw: "Father-in-law", motherInLaw: "Mother-in-law", parentInLaw: "Parent-in-law",
    sonInLaw: "Son-in-law", daughterInLaw: "Daughter-in-law", childInLaw: "Child-in-law",
    brotherInLaw: "Brother-in-law", sisterInLaw: "Sister-in-law", siblingInLaw: "Sibling-in-law",
    guardian: "Guardian", ward: "Ward",
    inLawRelative: "In-law relative", relative: "Relative"
  },
  modifiers: { step: "Step{lc}", adoptive: "Adoptive {lc}", foster: "Foster {lc}", half: "Half-{lc}" },
  overrides: {
    "uncleAunt:step": "Step-uncle/aunt", "olderUncleAunt:step": "Step-uncle/aunt", "youngerUncleAunt:step": "Step-uncle/aunt",
    "nibling:half": "Half-niece/nephew"
  }
};
