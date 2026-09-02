import { describe, expect, it, vi } from "vitest";
import { generatePublicId, PUBLIC_ID_BYTES } from "./publicId";

describe("generatePublicId", () => {
  it("uses at least 128 bits of Web Crypto randomness", () => {
    const getRandomValues = vi.spyOn(globalThis.crypto, "getRandomValues");
    const id = generatePublicId();
    expect(PUBLIC_ID_BYTES).toBeGreaterThanOrEqual(16);
    expect(getRandomValues).toHaveBeenCalledOnce();
    expect((getRandomValues.mock.calls[0][0] as Uint8Array).byteLength).toBe(PUBLIC_ID_BYTES);
    expect(id).toMatch(/^[A-Za-z0-9_-]{22}$/);
    getRandomValues.mockRestore();
  });

  it("does not embed source identifiers and changes on every call", () => {
    const first = generatePublicId();
    const second = generatePublicId();
    expect(first).not.toBe(second);
    expect(first).not.toContain("tree");
  });
});
