import "server-only";
import type { ZodError } from "zod";
import { requireOwner } from "../auth/guard";
import type { Database } from "../db/client";
import { ApiProblem, handle, json, readJson } from "../http";
import { TreeServiceError, createTree, deleteTree, listOwned, loadTree, saveTree } from "./service";
import { ID, createBody, saveBody } from "./validation";

/** Whole trees travel in one request; 4 MB comfortably fits thousands of people. */
const MAX_TREE_BODY = 4 * 1024 * 1024;

function invalid(error: ZodError): ApiProblem {
  return new ApiProblem(400, "invalid", "The family tree data is not valid.", error.issues.slice(0, 20).map(issue => ({ path: issue.path.join("."), message: issue.message })));
}

/** PostgreSQL rejections of the data itself (bad encoding, CHECK, FK, malformed value). */
const DATA_ERRORS = new Set(["22021", "22P02", "22001", "23502", "23503", "23514"]);
function pgCode(error: unknown): string | undefined {
  const candidate = error as { code?: unknown; cause?: { code?: unknown } } | null;
  const code = candidate?.code ?? candidate?.cause?.code;
  return typeof code === "string" ? code : undefined;
}

function serviceProblem(error: unknown): never {
  // Backstop: if validation ever misses a database rule, answer 400 (the client keeps it as invalid
  // data) instead of 500, which the client treats as "offline" and would retry forever.
  if (DATA_ERRORS.has(pgCode(error) ?? "")) throw new ApiProblem(400, "invalid", "The family tree data is not valid.");
  if (error instanceof TreeServiceError) {
    if (error.code === "conflict") throw new ApiProblem(409, "conflict", error.message, error.current ? { current: error.current } : undefined);
    throw new ApiProblem(404, "not-found", error.message);
  }
  throw error;
}

function treeId(raw: string): string {
  const parsed = ID.safeParse(raw);
  if (!parsed.success) throw new ApiProblem(404, "not-found", "Family tree was not found.");
  return parsed.data;
}

/** GET /api/trees */
export const listTrees = (request: Request, db: Database) => handle(async () => {
  const { user } = await requireOwner(request, db);
  return json({ trees: await listOwned(db, user.id) });
});

/** POST /api/trees — body { tree } */
export const postTree = (request: Request, db: Database) => handle(async () => {
  const { user } = await requireOwner(request, db);
  const parsed = createBody.safeParse(await readJson(request, MAX_TREE_BODY));
  if (!parsed.success) throw invalid(parsed.error);
  const tree = await createTree(db, user.id, parsed.data.tree).catch(serviceProblem);
  return json({ tree }, { status: 201 });
});

/** GET /api/trees/:id */
export const getTree = (request: Request, db: Database, id: string) => handle(async () => {
  const { user } = await requireOwner(request, db);
  return json({ tree: await loadTree(db, user.id, treeId(id)).catch(serviceProblem) });
});

/** PUT /api/trees/:id — body { tree, expectedRevision } */
export const putTree = (request: Request, db: Database, id: string) => handle(async () => {
  const { user } = await requireOwner(request, db);
  const parsed = saveBody.safeParse(await readJson(request, MAX_TREE_BODY));
  if (!parsed.success) throw invalid(parsed.error);
  if (parsed.data.tree.id !== treeId(id)) throw new ApiProblem(400, "invalid", "The tree id does not match the address.");
  return json({ tree: await saveTree(db, user.id, parsed.data.tree, parsed.data.expectedRevision).catch(serviceProblem) });
});

/** DELETE /api/trees/:id */
export const removeTree = (request: Request, db: Database, id: string) => handle(async () => {
  const { user } = await requireOwner(request, db);
  await deleteTree(db, user.id, treeId(id)).catch(serviceProblem);
  return json({ ok: true });
});
