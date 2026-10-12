/**
 * Uploaded photos are small thumbnails: JPEG or WebP, at most 256 px on the long side and 48 KB.
 * In the browser they are base64 data URLs until uploaded; the server stores the bytes in PostgreSQL and
 * checks the same limits (PHOTO_MAX_BYTES in src/server/db/schema.ts; 65536 base64 chars = 49152 bytes).
 */
export const PHOTO_MAX_SIDE = 256;
/** Hard limit (≈ 48 KB of image bytes once base64-decoded). */
export const PHOTO_MAX_CHARS = 65536;
/** Compression aims well below the limit so browser storage stays small. */
export const PHOTO_TARGET_CHARS = 40000;

const INLINE_PHOTO = /^data:image\/(jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/;

export function isInlinePhoto(value: unknown): boolean {
  return typeof value === "string" && value.length <= PHOTO_MAX_CHARS && INLINE_PHOTO.test(value);
}

/** Fit a width × height image inside PHOTO_MAX_SIDE, never upscaling. */
export function thumbnailSize(width: number, height: number, max = PHOTO_MAX_SIDE): { width: number; height: number } {
  if (width <= 0 || height <= 0) throw new Error("This image has no size.");
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

export type Encoder = (type: "image/webp" | "image/jpeg", quality: number) => string;

/**
 * Try WebP, then JPEG, lowering quality until the data URL fits the target (or at least the hard limit).
 * `encode` wraps canvas.toDataURL; browsers that cannot write WebP return PNG, which is skipped.
 */
export function encodeWithinLimit(encode: Encoder): string {
  let best: string | null = null;
  for (const type of ["image/webp", "image/jpeg"] as const) {
    for (let quality = 0.86; quality >= 0.3; quality -= 0.08) {
      const result = encode(type, Number(quality.toFixed(2)));
      if (!result.startsWith(`data:${type};`)) break;
      if (isInlinePhoto(result) && (!best || result.length < best.length)) best = result;
      if (best && best.length <= PHOTO_TARGET_CHARS) return best;
    }
  }
  if (best) return best;
  throw new Error("This photo could not be made small enough. Try another image.");
}

/** Painted under transparent PNGs (JPEG has no alpha); matches the --base design token. */
const THUMBNAIL_BACKGROUND = "#fffdf8";
const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];
export const PHOTO_ACCEPT = ACCEPTED.join(",");

/** Browser-only: decode an uploaded file, shrink it onto a canvas and encode it as an inline thumbnail. */
export async function compressPhoto(file: Blob): Promise<string> {
  if (!ACCEPTED.includes(file.type)) throw new Error("Choose a JPG, PNG or WebP image.");
  if (file.size > 25 * 1024 * 1024) throw new Error("This image is too large.");
  const bitmap = await createImageBitmap(file);
  try {
    const size = thumbnailSize(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("This browser cannot resize images.");
    // JPEG has no transparency; paint the app background under transparent PNGs.
    context.fillStyle = THUMBNAIL_BACKGROUND;
    context.fillRect(0, 0, size.width, size.height);
    context.drawImage(bitmap, 0, 0, size.width, size.height);
    return encodeWithinLimit((type, quality) => canvas.toDataURL(type, quality));
  } finally {
    bitmap.close();
  }
}

/** Decode a base64 image data URL into the bytes and type the photo endpoint expects. */
export function dataUrlToBytes(dataUrl: string): { mime: "image/jpeg" | "image/webp"; bytes: Uint8Array } {
  const match = /^data:(image\/(?:jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl);
  if (!match) throw new Error("This photo is not a JPG or WebP thumbnail.");
  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return { mime: match[1] as "image/jpeg" | "image/webp", bytes };
}

/**
 * Make any picked or older embedded image uploadable: thumbnails pass through, anything else (a large
 * PNG from the first app version, say) is decoded and shrunk in the browser first.
 */
/** Any embedded image as an uploadable thumbnail data URL (older, larger images are shrunk first). */
export async function toThumbnailDataUrl(dataUrl: string): Promise<string> {
  if (isInlinePhoto(dataUrl)) return dataUrl;
  if (!dataUrl.startsWith("data:image/")) throw new Error("This photo is not an image.");
  return compressPhoto(await (await fetch(dataUrl)).blob());
}

export async function prepareUpload(dataUrl: string): Promise<{ mime: "image/jpeg" | "image/webp"; bytes: Uint8Array }> {
  if (isInlinePhoto(dataUrl)) return dataUrlToBytes(dataUrl);
  if (!dataUrl.startsWith("data:image/")) throw new Error("This photo is not an image.");
  const blob = await (await fetch(dataUrl)).blob();
  return dataUrlToBytes(await compressPhoto(blob));
}
