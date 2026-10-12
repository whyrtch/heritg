import { describe, expect, it } from "vitest";
import { getAuthErrorMessage } from "./authErrors";

describe("getAuthErrorMessage", () => {
  it("maps invalid credentials without revealing whether an account exists", () => {
    expect(getAuthErrorMessage({ code: "invalid-credentials" })).toBe("The email or password is incorrect.");
    expect(getAuthErrorMessage({ code: "rate-limited" })).toBe("Too many attempts. Wait a moment and try again.");
    expect(getAuthErrorMessage({ code: "offline" })).toMatch(/Unable to connect/);
  });

  it("does not expose raw errors", () => {
    expect(getAuthErrorMessage(new Error("private backend detail"))).toBe("Something went wrong. Please try again.");
  });
});
