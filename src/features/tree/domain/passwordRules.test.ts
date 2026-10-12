import { describe, expect, it } from "vitest";
import { checkPassword } from "./passwordRules";

describe("checkPassword", () => {
  it("accepts a strong password", () => {
    expect(checkPassword("Keluarga#2026")).toEqual({ length8: true, lower: true, upper: true, digit: true, symbol: true, ok: true });
  });
  it("reports each missing rule", () => {
    expect(checkPassword("")).toMatchObject({ length8: false, ok: false });
    expect(checkPassword("Ab1!")).toMatchObject({ length8: false, lower: true, upper: true, digit: true, symbol: true, ok: false });
    expect(checkPassword("keluarga#2026")).toMatchObject({ upper: false, ok: false });
    expect(checkPassword("KELUARGA#2026")).toMatchObject({ lower: false, ok: false });
    expect(checkPassword("Keluarga#abc")).toMatchObject({ digit: false, ok: false });
    expect(checkPassword("Keluarga2026")).toMatchObject({ symbol: false, ok: false });
  });
  it("does not count spaces as symbols", () => {
    expect(checkPassword("Keluarga 2026").symbol).toBe(false);
  });
});
