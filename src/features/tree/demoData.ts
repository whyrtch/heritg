import type { FamilyTree, Gender, Person, Relationship } from "./model";

export const JOKOWI_DEMO_TREE_ID = "demo-jokowi-family-v1";

const person = (id: string, firstName: string, lastName = "", gender: Gender = "unspecified", birthDate = "", deathDate = "", notes = ""): Person => ({
  id, firstName, lastName, gender, birthDate, deathDate, notes, photoUrl: "", photo: ""
});
const partner = (from: string, to: string): Relationship => ({ id: `partner-${from}-${to}`, type: "partner", from, to });
const child = (from: string, to: string): Relationship => ({ id: `child-${from}-${to}`, type: "parent-child", from, to });

export function createJokowiDemoTree(): FamilyTree {
  const people = [
    person("lamidi", "Lamidi", "Wiryo Miharjo", "male", "", "", "Kakek Joko Widodo dari pihak ayah."),
    person("painem", "Painem", "", "female", "", "", "Nenek Joko Widodo dari pihak ayah."),
    person("wiroredjo", "Wiroredjo", "", "male", "", "", "Kakek Joko Widodo dari pihak ibu."),
    person("insani", "Insani “Sani”", "Wiroredjo", "female", "1913-01-01", "2015-10-23", "Nenek Joko Widodo dari pihak ibu."),
    person("widjiatno", "Widjiatno", "Notomihardjo", "male", "1940-12-30", "2000-07-23", "Ayah Joko Widodo; pengusaha dan pedagang kayu."),
    person("sudjiatmi", "Sudjiatmi", "Notomihardjo", "female", "1943-02-15", "2020-03-25", "Ibu Joko Widodo."),
    person("jokowi", "Joko", "Widodo", "male", "1961-06-21", "", "Presiden Republik Indonesia ke-7 (2014–2024)."),
    person("iriana", "Iriana", "Joko Widodo", "female", "1963-10-01"),
    person("gibran", "Gibran Rakabuming", "Raka", "male", "1987-10-01"),
    person("selvi", "Selvi", "Ananda", "female", "1989-01-09"),
    person("kahiyang", "Kahiyang", "Ayu", "female", "1991-04-20"),
    person("bobby", "Bobby", "Nasution", "male", "1991-07-05"),
    person("kaesang", "Kaesang", "Pangarep", "male", "1994-12-25"),
    person("erina", "Erina", "Gudono", "female", "1996-12-11"),
    person("jan-ethes", "Jan Ethes", "Srinarendra", "male", "2016-03-10"),
    person("la-lembah", "La Lembah", "Manah", "female", "2019-11-15"),
    person("sedah-mirah", "Sedah Mirah", "Nasution", "female", "2018-08-01"),
    person("al-nahyan", "Panembahan Al Nahyan", "Nasution", "male", "2020-08-03"),
    person("al-saud", "Panembahan Al Saud", "Nasution", "male", "2022-08-25"),
    person("bebingah", "Bebingah Sang", "Tansahayu", "female", "2024-10-15")
  ];
  const relationships = [
    partner("lamidi", "painem"), partner("wiroredjo", "insani"),
    child("lamidi", "widjiatno"), child("painem", "widjiatno"),
    child("wiroredjo", "sudjiatmi"), child("insani", "sudjiatmi"),
    partner("widjiatno", "sudjiatmi"), child("widjiatno", "jokowi"), child("sudjiatmi", "jokowi"),
    partner("jokowi", "iriana"),
    child("jokowi", "gibran"), child("iriana", "gibran"),
    child("jokowi", "kahiyang"), child("iriana", "kahiyang"),
    child("jokowi", "kaesang"), child("iriana", "kaesang"),
    partner("gibran", "selvi"), partner("kahiyang", "bobby"), partner("kaesang", "erina"),
    child("gibran", "jan-ethes"), child("selvi", "jan-ethes"),
    child("gibran", "la-lembah"), child("selvi", "la-lembah"),
    child("kahiyang", "sedah-mirah"), child("bobby", "sedah-mirah"),
    child("kahiyang", "al-nahyan"), child("bobby", "al-nahyan"),
    child("kahiyang", "al-saud"), child("bobby", "al-saud"),
    child("kaesang", "bebingah"), child("erina", "bebingah")
  ];
  return { id: JOKOWI_DEMO_TREE_ID, name: "Keluarga Joko Widodo", people, relationships, updatedAt: "2026-08-31T00:00:00.000Z" };
}
