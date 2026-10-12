// One-time move of the owner's family trees from Firestore to PostgreSQL (own backend B6).
//
//   npm run migrate:firestore -- --dry-run                  read Firestore, validate, report; write nothing
//   npm run migrate:firestore                               import (trees that already exist are skipped)
//   npm run migrate:firestore -- --overwrite                re-import and replace the content of existing trees
//                                                           (a public link already made on the new backend is kept)
//   npm run migrate:firestore -- --save-json backup.json    also keep a copy of what was read (git-ignored)
//   npm run migrate:firestore -- --from-json backup.json    import a saved copy instead of reading Firebase
//
// Environment (.env.local): DATABASE_URL, OWNER_EMAIL (the account made with owner:create),
// FIREBASE_OWNER_UID and GOOGLE_APPLICATION_CREDENTIALS (path to a service-account JSON; not needed with
// --from-json). Firebase is only ever read; nothing there is changed or deleted.
import { readFileSync, writeFileSync } from "node:fs";
import { loadEnv } from "./owner-cli";

function flag(name: string): boolean { return process.argv.includes(name); }
function option(name: string): string | undefined { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : undefined; }

async function main() {
  loadEnv();
  const { closeDb, getDb } = await import("@/server/db/client");
  const { findUserByEmail } = await import("@/server/auth/users");
  const { importFirestoreExport, parseFirestoreExport } = await import("@/server/migration/firestoreImport");
  const dryRun = flag("--dry-run"), overwrite = flag("--overwrite");

  const email = process.env.OWNER_EMAIL;
  if (!email) throw new Error("Set OWNER_EMAIL to the owner account created with npm run owner:create.");
  const db = getDb();
  const owner = await findUserByEmail(db, email);
  if (!owner) throw new Error(`No account for ${email}. Run npm run owner:create first.`);

  let data;
  const fromJson = option("--from-json");
  if (fromJson) data = parseFirestoreExport(JSON.parse(readFileSync(fromJson, "utf8")));
  else {
    const uid = process.env.FIREBASE_OWNER_UID;
    if (!uid) throw new Error("Set FIREBASE_OWNER_UID (the owner's Firebase Authentication user id).");
    if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) throw new Error("Set GOOGLE_APPLICATION_CREDENTIALS to the service-account JSON path.");
    const { readOwnerExport } = await import("./firestore-reader");
    data = await readOwnerExport(uid, process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);
    const saveTo = option("--save-json");
    if (saveTo) { writeFileSync(saveTo, JSON.stringify(data, null, 2)); console.log(`Saved what was read to ${saveTo}.`); }
  }

  console.log(`${dryRun ? "DRY RUN — nothing will be written.\n" : ""}Importing ${data.trees.length} tree(s) for ${owner.email}${overwrite ? " (overwriting existing trees)" : ""}…`);
  const outcomes = await importFirestoreExport(db, owner.id, data, { dryRun, overwrite });
  for (const outcome of outcomes) {
    console.log(`- ${outcome.name} [${outcome.treeId}]: ${outcome.result}, ${outcome.people} people, ${outcome.relationships} relationships, public link: ${outcome.publication}`);
    for (const problem of outcome.problems) console.log(`    ! ${problem}`);
  }
  const failed = outcomes.filter(outcome => outcome.result === "failed").length;
  const brokenLinks = outcomes.filter(outcome => outcome.publication === "failed").length;
  if (failed) console.log(`${failed} tree(s) could not be imported; see the problems above.`);
  if (brokenLinks) console.log(`${brokenLinks} shared link(s) could not be restored, so those links do not work yet. Fix the problems above and run the import again: existing trees are kept and missing links are restored.`);
  if (!failed && !brokenLinks) console.log("Done.");
  await closeDb();
  process.exit(failed || brokenLinks ? 1 : 0);
}

main().catch(error => {
  const cause = (error as { cause?: { code?: string; message?: string } })?.cause;
  console.error(cause?.code === "ECONNREFUSED" ? "Cannot reach the database in DATABASE_URL. Is PostgreSQL running?" : error instanceof Error ? `${error.message}${cause?.message ? ` (${cause.message})` : ""}` : error);
  process.exit(1);
});
