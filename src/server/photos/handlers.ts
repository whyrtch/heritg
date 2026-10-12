import "server-only";
import { requireOwner } from "../auth/guard";
import type { Database } from "../db/client";
import { ApiProblem, handle, json, readLimited } from "../http";
import { TreeServiceError } from "../trees/service";
import { ID } from "../trees/validation";
import { PUBLIC_ID } from "../publications/service";
import { PHOTO_MAX_BYTES, deletePhoto, getPhoto, getPublicPhoto, putPhoto, sniffImage, type StoredPhoto } from "./service";

const NOT_FOUND = () => new ApiProblem(404, "not-found", "Photo was not found.");
const ids = (...values: string[]) => values.map(value => { const parsed = ID.safeParse(value); if (!parsed.success) throw NOT_FOUND(); return parsed.data; });
const serviceProblem = (error: unknown): never => { if (error instanceof TreeServiceError) throw NOT_FOUND(); throw error; };

/** Image responses can never be interpreted as anything else (no sniffing, no scripts). */
function imageResponse(request: Request, photo: StoredPhoto, cacheControl: string, extra: Record<string, string> = {}): Response {
  const etag = `"${photo.sha256}"`;
  const headers = { "Content-Type": photo.mime, ETag: etag, "Cache-Control": cacheControl, "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; sandbox", ...extra };
  if (request.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers });
  return new Response(photo.bytes as unknown as BodyInit, { status: 200, headers: { ...headers, "Content-Length": String(photo.bytes.byteLength) } });
}

/** PUT /api/trees/:id/people/:personId/photo — raw JPEG or WebP body, at most 48 KB. */
export const putPersonPhoto = (request: Request, db: Database, treeId: string, personId: string) => handle(async () => {
  const { user } = await requireOwner(request, db);
  const [tree, person] = ids(treeId, personId);
  const declared = (request.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (declared !== "image/jpeg" && declared !== "image/webp") throw new ApiProblem(415, "invalid", "Upload a JPG or WebP image.");
  const bytes = await readLimited(request, PHOTO_MAX_BYTES);
  const mime = sniffImage(bytes);
  if (!mime || mime !== declared) throw new ApiProblem(400, "invalid", "This file is not a JPG or WebP image.");
  return json({ photoVersion: await putPhoto(db, user.id, tree, person, bytes, mime).catch(serviceProblem) });
});

/** GET /api/trees/:id/people/:personId/photo?v=… — owner only; the version in the URL makes it cacheable. */
export const getPersonPhoto = (request: Request, db: Database, treeId: string, personId: string) => handle(async () => {
  const { user } = await requireOwner(request, db);
  const [tree, person] = ids(treeId, personId);
  return imageResponse(request, await getPhoto(db, user.id, tree, person).catch(serviceProblem), "private, max-age=31536000, immutable");
});

/** DELETE /api/trees/:id/people/:personId/photo */
export const deletePersonPhoto = (request: Request, db: Database, treeId: string, personId: string) => handle(async () => {
  const { user } = await requireOwner(request, db);
  const [tree, person] = ids(treeId, personId);
  await deletePhoto(db, user.id, tree, person).catch(serviceProblem);
  return json({ ok: true });
});

/**
 * GET /api/public/:publicId/photos/:personId — anyone with the link, while it is enabled. Browsers must
 * revalidate (no-cache + ETag) so a revoked link stops showing photos.
 */
export const getPublicPersonPhoto = (request: Request, db: Database, publicId: string, personId: string) => handle(async () => {
  const notFound = () => json({ error: { code: "not-found", message: "Photo was not found." } }, { status: 404, headers: { "X-Robots-Tag": "noindex, nofollow" } });
  if (!PUBLIC_ID.test(publicId) || !ID.safeParse(personId).success) return notFound();
  const photo = await getPublicPhoto(db, publicId, personId);
  if (!photo) return notFound();
  return imageResponse(request, photo, "no-cache", { "X-Robots-Tag": "noindex, nofollow", "Referrer-Policy": "no-referrer" });
});
