import { describe, expect, it } from "vitest";
import { getAuthErrorMessage } from "./authErrors";

describe("getAuthErrorMessage", () => {
  it("maps invalid credentials without revealing whether an account exists", () => {
    expect(getAuthErrorMessage({ code: "invalid-credentials" })).toBe("Email atau password salah.");
    expect(getAuthErrorMessage({ code: "rate-limited" })).toBe("Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.");
    expect(getAuthErrorMessage({ code: "offline" })).toMatch(/Nggak bisa terhubung/);
  });

  it("does not expose raw errors", () => {
    expect(getAuthErrorMessage(new Error("private backend detail"))).toBe("Ada yang salah. Coba lagi.");
  });
});
