import "server-only";
import { z } from "zod";
import { requireOwner } from "../auth/guard";
import type { Database } from "../db/client";
import { ApiProblem, handle, json, readJson } from "../http";
import { TreeServiceError } from "../trees/service";
import { ID } from "../trees/validation";
import { PUBLIC_ID, getPublication, loadPublicLink, publishTree, unpublishTree } from "./service";

const revisionBody = z.object({ expectedRevision: z.number().int().min(0) });
const optionsBody = z.object({ dates: z.boolean(), marriageDates: z.boolean(), photos: z.boolean() }).strict();
const common = {
  publicId: z.string().regex(PUBLIC_ID, "Invalid link id."),
  expectedRevision: z.number().int().min(0),
  options: optionsBody.optional(),
  expiresInDays: z.union([z.literal(7), z.literal(30), z.literal(90), z.null()]).optional(),
};
/** Plain publish. Without `mode` the link keeps its current mode (so a regenerate never opens a protected link). */
const plainBody = z.object({ ...common, mode: z.literal("plain").optional() }).strict();

/** The most base64 characters the server keeps for one protected link; the database CHECK uses the same number. */
export const CIPHERTEXT_MAX_CHARS = 4_000_000;
/** The request carrying it: the ciphertext plus a little JSON around it. */
export const PASSWORD_BODY_MAX_BYTES = 4_500_000;
const PLAIN_BODY_MAX_BYTES = 1024;
const base64Of = (bytes: number) => z.string().length(Math.ceil(bytes / 3) * 4).regex(/^[A-Za-z0-9+/]+={0,2}$/);
/** Exactly the envelope secureFile.ts produces; anything else (other KDF, weak iterations, odd sizes) is refused. */
const envelopeBody = z.object({
  format: z.literal("heritg-encrypted"),
  version: z.literal(1),
  kdf: z.object({ name: z.literal("PBKDF2"), hash: z.literal("SHA-256"), iterations: z.number().int().min(100_000).max(5_000_000), salt: base64Of(16) }).strict(),
  cipher: z.object({ name: z.literal("AES-GCM"), iv: base64Of(12) }).strict(),
  // At least the 16-byte GCM tag; length must be a multiple of 4 with padding only at the end.
  data: z.string().min(24).max(CIPHERTEXT_MAX_CHARS).regex(/^[A-Za-z0-9+/]+={0,2}$/).refine(value => value.length % 4 === 0),
}).strict();
const passwordBody = z.object({ ...common, mode: z.literal("password"), envelope: envelopeBody }).strict();
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

/** GET /api/trees/:id/publication — the owner's link settings { publication: { options, expiresAt, mode } | null }. */
export const getPublicationSettings = (request: Request, db: Database, id: string) => handle(async () => {
  const { user } = await requireOwner(request, db);
  return json({ publication: await getPublication(db, user.id, treeId(id)) });
});

/**
 * PUT /api/trees/:id/publication — publishes the stored tree.
 * Plain: { publicId, expectedRevision, options?, expiresInDays?, mode? }.
 * Password: { mode: "password", envelope, publicId, expectedRevision, options?, expiresInDays? } — the envelope is the
 * snapshot encrypted in the browser; the server stores it as is and never sees the password or the content.
 * Only this route accepts a large body, and only an authenticated owner reaches the reader.
 */
export const putPublication = (request: Request, db: Database, id: string) => handle(async () => {
  const { user } = await requireOwner(request, db);
  const body = await readJson(request, PASSWORD_BODY_MAX_BYTES);
  const isPassword = typeof body === "object" && body !== null && (body as { mode?: unknown }).mode === "password";
  // The big allowance is for password mode only; a plain request keeps its old limit.
  if (!isPassword && Buffer.byteLength(JSON.stringify(body)) > PLAIN_BODY_MAX_BYTES) throw new ApiProblem(413, "too-large", "This request is too large.");
  const parsed = (isPassword ? passwordBody : plainBody).safeParse(body);
  if (!parsed.success) throw new ApiProblem(400, "invalid", "The link request is not valid.");
  const { publicId, expectedRevision, options, expiresInDays, mode } = parsed.data;
  const { envelope } = parsed.data as { envelope?: z.infer<typeof envelopeBody> };
  const encrypted = envelope ? { ciphertext: envelope.data, crypto: { format: envelope.format, version: envelope.version, kdf: envelope.kdf, cipher: envelope.cipher } } : undefined;
  const tree = await publishTree(db, user.id, treeId(id), publicId, expectedRevision, { options, expiresInDays, mode, encrypted }).catch(serviceProblem);
  return json({ tree, publication: await getPublication(db, user.id, tree.id) });
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
    const snapshot = await loadPublicLink(db, publicId);
    if (!snapshot) return json({ error: { code: "not-found", message: "This family tree is unavailable." } }, { status: 404 });
    if ("encrypted" in snapshot) return json(snapshot);
    return json({ snapshot });
  });
  // Every outcome, errors included, stays out of search engines and caches.
  for (const [name, value] of Object.entries(PUBLIC_HEADERS)) response.headers.set(name, value);
  return response;
}
