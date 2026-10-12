import { describe, expect, it } from "vitest";
import { PHOTO_MAX_CHARS, PHOTO_TARGET_CHARS, encodeWithinLimit, isInlinePhoto, thumbnailSize } from "./photoData";

const dataUrl = (type: string, length: number) => `data:${type};base64,${"A".repeat(length)}`;

describe("inline photos", () => {
  it("accepts small base64 JPEG and WebP data URLs only", () => {
    expect(isInlinePhoto(dataUrl("image/jpeg", 100))).toBe(true);
    expect(isInlinePhoto(dataUrl("image/webp", 100) + "==")).toBe(true);
    expect(isInlinePhoto(dataUrl("image/png", 100))).toBe(false);
    expect(isInlinePhoto(dataUrl("image/svg+xml", 100))).toBe(false);
    expect(isInlinePhoto("data:image/jpeg;base64,<script>")).toBe(false);
    expect(isInlinePhoto(dataUrl("image/jpeg", PHOTO_MAX_CHARS))).toBe(false);
    expect(isInlinePhoto("https://example.com/a.jpg")).toBe(false);
  });

  it("fits images inside 256 px without upscaling", () => {
    expect(thumbnailSize(1024, 768)).toEqual({ width: 256, height: 192 });
    expect(thumbnailSize(300, 1200)).toEqual({ width: 64, height: 256 });
    expect(thumbnailSize(100, 80)).toEqual({ width: 100, height: 80 });
    expect(() => thumbnailSize(0, 10)).toThrow();
  });

  it("lowers quality until the photo fits the target", () => {
    const qualities: number[] = [];
    const result = encodeWithinLimit((type, quality) => { qualities.push(quality); return dataUrl(type, quality > 0.6 ? 60000 : 30000); });
    expect(result.startsWith("data:image/webp;")).toBe(true);
    expect(result.length).toBeLessThanOrEqual(PHOTO_TARGET_CHARS);
    expect(qualities[0]).toBe(0.86);
  });

  it("falls back to JPEG when the browser cannot write WebP", () => {
    const result = encodeWithinLimit((type) => type === "image/webp" ? dataUrl("image/png", 10) : dataUrl("image/jpeg", 2000));
    expect(result.startsWith("data:image/jpeg;")).toBe(true);
  });

  it("keeps the smallest result under the hard limit, or fails", () => {
    expect(encodeWithinLimit(type => dataUrl(type, 50000)).length).toBeLessThanOrEqual(PHOTO_MAX_CHARS);
    expect(() => encodeWithinLimit(type => dataUrl(type, PHOTO_MAX_CHARS + 10))).toThrow(/small enough/);
  });
});
