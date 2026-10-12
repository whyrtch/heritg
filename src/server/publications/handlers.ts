import "server-only";
import { z } from "zod";
import { requireOwner } from "../auth/guard";
import type { Database } from "../db/client";
import { ApiProblem, handle, json, readJson } from "../http";
import { TreeServiceError } from "../trees/service";
import { ID } from "../trees/validation";
import { PUBLIC_ID, loadPublicSnapshot, publishTree, unpublishTree } from "./service";

const revisionBody = z.object({ expectedRevision: z.number().int().min(0) });
const publishBody = z.object({ publicId: z.string().regex(PUBLIC_ID, "Invalid link id."), expectedRevision: z.number().int().min(0) });
const NOT_FOUND = () => new ApiProblem(404, "not-found", "Family tree was not found.");

function treeId(raw: string): string {
  const parsed = ID.safeParse(raw);
  if (!parsed.success) throw NOT_FOUND();
  return parsed.data;
}

function serviceProblem(error: unknown): never {
  if (error instanceof TreeServiceError) throw error.code === "conflict" ? new ApiProblem(409, "conflict", error.message) : NOT_FOUND();
  throw error;
}

/** PUT /api/trees/:id/publication — body { publicId, expectedRevision }; publishes the stored tree. */
export const putPublication = (request: Request, db: Database, id: string) => handle(async () => {
  const { user } = await requireOwner(request, db);
  const parsed = publishBody.safeParse(await readJson(request, 1024));
  if (!parsed.success) throw new ApiProblem(400, "invalid", "The link request is not valid.");
  return json({ tree: await publishTree(db, user.id, treeId(id), parsed.data.publicId, parsed.data.expectedRevision).catch(serviceProblem) });
});

/** DELETE /api/trees/:id/publication — body { expectedRevision }; revokes the link and makes the tree private. */
export const deletePublication = (request: Request, db: Database, id: string) => handle(async () => {
  const { user } = await requireOwner(request, db);
  const parsed = revisionBody.safeParse(await readJson(request, 1024));
  if (!parsed.success) throw new ApiProblem(400, "invalid", "The link request is not valid.");
  return json({ tree: await unpublishTree(db, user.id, treeId(id), parsed.data.expectedRevision).catch(serviceProblem) });
});

const PUBLIC_HEADERS = { "X-Robots-Tag": "noindex, nofollow", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" };

/** GET /api/public/:publicId — no sign-in; unknown, disabled and malformed links all give the same 404. */
export async function getPublicSnapshot(_request: Request, db: Database, publicId: string): Promise<Response> {
  const response = await handle(async () => {
    const snapshot = await loadPublicSnapshot(db, publicId);
    if (!snapshot) return json({ error: { code: "not-found", message: "This family tree is unavailable." } }, { status: 404 });
    return json({ snapshot });
  });
  // Every outcome, errors included, stays out of search engines and caches.
  for (const [name, value] of Object.entries(PUBLIC_HEADERS)) response.headers.set(name, value);
  return response;
}
