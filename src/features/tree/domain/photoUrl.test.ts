import { describe, expect, it } from "vitest";
import { isLegacyDataUrlPhoto, validatePhotoUrl } from "./photoUrl";

describe("photo URL validation", () => {
  it("accepts empty and HTTPS photo URLs", () => {
    expect(validatePhotoUrl("")).toEqual({ ok: true });
    expect(validatePhotoUrl("https://images.example.test/person.webp")).toEqual({ ok: true });
  });

  it("rejects non-HTTPS, data, malformed, and credentialed URLs", () => {
    expect(validatePhotoUrl("http://images.example.test/person.webp").ok).toBe(false);
    expect(validatePhotoUrl("data:image/png;base64,AAAA").ok).toBe(false);
    expect(validatePhotoUrl("not a URL").ok).toBe(false);
    expect(validatePhotoUrl("https://user:secret@example.test/photo.jpg").ok).toBe(false);
  });

  it("recognizes legacy embedded images", () => {
    expect(isLegacyDataUrlPhoto("data:image/png;base64,AAAA")).toBe(true);
    expect(isLegacyDataUrlPhoto("https://example.test/photo.png")).toBe(false);
  });
});
