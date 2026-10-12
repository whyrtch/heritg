import "server-only";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { fromOnlineTree, toOnlineTree } from "@/features/tree/domain/serialization";
import type { Database } from "../db/client";
import { publications, trees } from "../db/schema";
import { createTree, saveTree } from "../trees/service";
import { treeInput, type TreeInput } from "../trees/validation";
import { PUBLIC_ID, type PublicSnapshotBody } from "../publications/service";

/**
 * One-time move of an owner's Firestore data into PostgreSQL (own backend B6). The reader
 * (scripts/firestore-reader.ts) turns Firestore documents into this plain export, with timestamps as ISO
 * strings; everything here is pure database work, so it is tested against PGlite.
 */
export type FirestoreDocument = { id: string; data: Record<string, unknown> };
export type FirestoreTreeExport = FirestoreDocument & {
  people: FirestoreDocument[];
  relationships: FirestoreDocument[];
  /** The public snapshot as it was published (publicTrees/{publicId} and its subcollections), if any. */
  publication?: FirestoreDocument & { people: FirestoreDocument[]; relationships: FirestoreDocument[] };
};
export type FirestoreExport = { exportedAt: string; ownerUid: string; trees: FirestoreTreeExport[] };

export type ImportOptions = { dryRun: boolean; overwrite: boolean };
/**
 * `publication`: "kept" = the tree already has its own sharing state on the new backend (a link, or a link the
 * owner revoked there), which an import never changes.
 */
export type TreeOutcome = { treeId: string; name: string; result: "created" | "overwritten" | "skipped-existing" | "would-create" | "would-overwrite" | "failed"; people: number; relationships: number; publication: "restored" | "would-restore" | "kept" | "none" | "failed"; problems: string[] };

const documentShape = z.object({ id: z.string().min(1), data: z.record(z.string(), z.unknown()) });
const exportShape = z.object({
  exportedAt: z.string(), ownerUid: z.string(),
  trees: z.array(documentShape.extend({
    people: z.array(documentShape), relationships: z.array(documentShape),
    publication: documentShape.extend({ people: z.array(documentShape), relationships: z.array(documentShape) }).optional(),
  })),
});

/** Check a (possibly hand-edited) export before importing anything. */
export function parseFirestoreExport(value: unknown): FirestoreExport {
  const parsed = exportShape.safeParse(value);
  if (!parsed.success) throw new Error(`The export file is not in the expected shape: ${parsed.error.issues.slice(0, 3).map(issue => `${issue.path.join(".")} ${issue.message}`).join("; ")}`);
  return parsed.data;
}

const iso = (value: unknown, fallback: string) => typeof value === "string" && !Number.isNaN(Date.parse(value)) ? value : fallback;

/** Firestore documents → the v2 tree our API accepts (v1 people and relationships are upgraded on the way). */
function normalizeTree(source: FirestoreTreeExport, ownerId: string, now: string): { input: TreeInput; createdAt: string } {
  const updatedAt = iso(source.data.updatedAt, now);
  const createdAt = iso(source.data.createdAt, updatedAt);
  const local = fromOnlineTree({
    id: source.id, ownerId, name: source.data.name, visibility: "private", publicId: null,
    revision: Number.isSafeInteger(source.data.revision) ? source.data.revision : 0,
    schemaVersion: source.data.schemaVersion, createdAt, updatedAt, publishedRevision: null,
    people: source.people.map(item => ({ ...item.data, id: item.id, updatedAt: iso(item.data.updatedAt, updatedAt) })),
    relationships: source.relationships.map(item => ({ ...item.data, id: item.id, updatedAt: iso(item.data.updatedAt, updatedAt) })),
  });
  const online = toOnlineTree(local, { ownerId, createdAt });
  const parsed = treeInput.safeParse({ ...online, schemaVersion: 2 });
  if (!parsed.success) throw new Error(parsed.error.issues.slice(0, 5).map(issue => `${issue.path.join(".")}: ${issue.message}`).join("; "));
  return { input: parsed.data, createdAt };
}

/** The public copy exactly as it was published in Firestore (never the tree's later private edits). */
function normalizeSnapshot(source: NonNullable<FirestoreTreeExport["publication"]>, ownerId: string, now: string): PublicSnapshotBody & { publishedAt: string; name: string } {
  const publishedAt = iso(source.data.publishedAt, now);
  const local = fromOnlineTree({
    id: source.id, ownerId, name: source.data.name, visibility: "unlisted", publicId: source.id, revision: 0, schemaVersion: source.data.schemaVersion,
    createdAt: publishedAt, updatedAt: publishedAt, publishedRevision: 0,
    people: source.people.map(item => ({ ...item.data, id: item.id, updatedAt: publishedAt })),
    relationships: source.relationships.map(item => ({ ...item.data, id: item.id, updatedAt: publishedAt })),
  });
  const online = toOnlineTree(local, { ownerId });
  const parsed = treeInput.safeParse({ id: "snapshot", name: local.name, schemaVersion: 2, people: online.people, relationships: online.relationships });
  if (!parsed.success) throw new Error(`public snapshot: ${parsed.error.issues[0]?.message ?? "invalid"}`);
  return { people: parsed.data.people.map(person => ({ ...person, photoVersion: null })), relationships: parsed.data.relationships, publishedAt, name: parsed.data.name };
}

/**
 * Import every tree of the export for `ownerId`. Firestore is only read (by the reader); here nothing is
 * deleted. Trees that already exist in PostgreSQL are skipped unless `overwrite` is set, so a re-run never
 * clobbers edits made on the new backend. Dry run: validate and report, write nothing.
 */
export async function importFirestoreExport(db: Database, ownerId: string, value: FirestoreExport, options: ImportOptions): Promise<TreeOutcome[]> {
  const data = parseFirestoreExport(value);
  const now = new Date().toISOString();
  const outcomes: TreeOutcome[] = [];
  for (const source of data.trees) {
    const outcome: TreeOutcome = { treeId: source.id, name: String(source.data.name ?? source.id), result: "failed", people: source.people.length, relationships: source.relationships.length, publication: "none", problems: [] };
    outcomes.push(outcome);
    // One tree failing (bad data, a database error) never stops the others.
    try {
      await importTree(db, ownerId, source, options, now, outcome);
    } catch (error) {
      outcome.problems.push(error instanceof Error ? error.message : String(error));
    }
  }
  return outcomes;
}

async function importTree(db: Database, ownerId: string, source: FirestoreTreeExport, options: ImportOptions, now: string, outcome: TreeOutcome): Promise<void> {
  let normalized: ReturnType<typeof normalizeTree>;
  try {
    normalized = normalizeTree(source, ownerId, now);
  } catch (error) {
    outcome.problems.push(error instanceof Error ? error.message : String(error));
    return;
  }
  const enabledPublication = source.publication && source.publication.data.enabled === true && PUBLIC_ID.test(source.publication.id) ? source.publication : undefined;
  let snapshot: ReturnType<typeof normalizeSnapshot> | null = null;
  if (enabledPublication) {
    try { snapshot = normalizeSnapshot(enabledPublication, ownerId, now); } catch (error) { outcome.problems.push(error instanceof Error ? error.message : String(error)); outcome.publication = "failed"; }
  }

  const [existing] = await db.select({ ownerId: trees.ownerId, revision: trees.revision }).from(trees).where(eq(trees.id, source.id)).limit(1);
  if (existing && existing.ownerId !== ownerId) { outcome.problems.push("This tree id belongs to another account in PostgreSQL."); return; }
  const [hasLink] = existing ? await db.select({ publicId: publications.publicId }).from(publications).where(eq(publications.treeId, source.id)).limit(1) : [];
  // A missing link is restored only while the tree is exactly as an earlier import left it (revision 0).
  // Any save, publish or revoke on the new backend raises the revision, and that sharing state is the
  // owner's: a link they revoked there must not come back.
  const leftByImport = !existing || existing.revision === 0;

  if (options.dryRun) {
    outcome.result = !existing ? "would-create" : options.overwrite ? "would-overwrite" : "skipped-existing";
    if (snapshot) outcome.publication = hasLink || !leftByImport ? "kept" : "would-restore";
    return;
  }

  if (!existing) {
    await createTree(db, ownerId, normalized.input, { createdAt: new Date(normalized.createdAt) });
    outcome.result = "created";
  } else if (options.overwrite) {
    await saveTree(db, ownerId, normalized.input, existing.revision);
    outcome.result = "overwritten";
  } else {
    outcome.result = "skipped-existing";
  }

  // The tree and its link are reported separately: a link that failed earlier is restored on a re-run,
  // and a link already made on the new backend is never replaced.
  if (!snapshot || !enabledPublication) return;
  if (hasLink || !leftByImport) { outcome.publication = "kept"; return; }
  try {
    await restorePublication(db, ownerId, source.id, enabledPublication.id, snapshot);
    outcome.publication = "restored";
  } catch (error) {
    outcome.publication = "failed";
    outcome.problems.push(error instanceof Error ? error.message : String(error));
  }
}

/** Re-create a public link with the same id, so links people already have keep working. */
async function restorePublication(db: Database, ownerId: string, treeId: string, publicId: string, snapshot: ReturnType<typeof normalizeSnapshot>): Promise<void> {
  await db.transaction(async tx => {
    const [row] = await tx.select().from(trees).where(and(eq(trees.id, treeId), eq(trees.ownerId, ownerId))).for("update").limit(1);
    if (!row) throw new Error("Tree disappeared during import.");
    const [taken] = await tx.select({ treeId: publications.treeId }).from(publications).where(eq(publications.publicId, publicId)).limit(1);
    if (taken && taken.treeId !== treeId) throw new Error("This public link id is already used by another tree.");
    await tx.delete(publications).where(eq(publications.treeId, treeId));
    const revision = row.revision + 1;
    await tx.insert(publications).values({ publicId, treeId, enabled: true, name: snapshot.name, schemaVersion: 2, publishedRevision: revision, publishedAt: new Date(snapshot.publishedAt), snapshot: { people: snapshot.people, relationships: snapshot.relationships } });
    await tx.update(trees).set({ visibility: "unlisted", publicId, revision, publishedRevision: revision, updatedAt: new Date() }).where(eq(trees.id, treeId));
  });
}
