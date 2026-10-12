// Reads one owner's Heritg data from Firestore with the Admin SDK. READ ONLY: this file never writes,
// updates or deletes anything in Firebase. Used by scripts/migrate-from-firestore.ts (own backend B6).
import { applicationDefault, initializeApp } from "firebase-admin/app";
import { Timestamp, getFirestore, type DocumentData, type QueryDocumentSnapshot } from "firebase-admin/firestore";
import type { FirestoreDocument, FirestoreExport, FirestoreTreeExport } from "../src/server/migration/firestoreImport";

/** Firestore Timestamps become ISO strings; everything else is copied as-is. */
function plain(data: DocumentData): Record<string, unknown> {
  return Object.fromEntries(Object.entries(data).map(([key, value]) => [key, value instanceof Timestamp ? value.toDate().toISOString() : value]));
}
const docs = (snapshot: { docs: QueryDocumentSnapshot[] }): FirestoreDocument[] => snapshot.docs.map(item => ({ id: item.id, data: plain(item.data()) }));

export async function readOwnerExport(ownerUid: string, projectId?: string): Promise<FirestoreExport> {
  const app = initializeApp({ credential: applicationDefault(), ...(projectId ? { projectId } : {}) }, "heritg-migration-reader");
  const db = getFirestore(app);
  const treeDocs = await db.collection("trees").where("ownerId", "==", ownerUid).get();
  const trees: FirestoreTreeExport[] = [];
  for (const tree of treeDocs.docs) {
    const [people, relationships] = await Promise.all([tree.ref.collection("people").get(), tree.ref.collection("relationships").get()]);
    const data = plain(tree.data());
    let publication: FirestoreTreeExport["publication"];
    if (data.visibility === "unlisted" && typeof data.publicId === "string") {
      const publicRef = db.collection("publicTrees").doc(data.publicId);
      const publicDoc = await publicRef.get();
      if (publicDoc.exists && publicDoc.data()?.sourceTreeId === tree.id) {
        const [publicPeople, publicRelationships] = await Promise.all([publicRef.collection("people").get(), publicRef.collection("relationships").get()]);
        publication = { id: publicDoc.id, data: plain(publicDoc.data() ?? {}), people: docs(publicPeople), relationships: docs(publicRelationships) };
      }
    }
    trees.push({ id: tree.id, data, people: docs(people), relationships: docs(relationships), ...(publication ? { publication } : {}) });
  }
  return { exportedAt: new Date().toISOString(), ownerUid, trees };
}
