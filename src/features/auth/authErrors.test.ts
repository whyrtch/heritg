import { describe, expect, it } from "vitest";
import { getAuthErrorMessage } from "./authErrors";

describe("getAuthErrorMessage", () => {
  it("maps invalid credentials without revealing whether an account exists", () => {
    expect(getAuthErrorMessage({ code: "auth/user-not-found" })).toBe("The email or password is incorrect.");
    expect(getAuthErrorMessage({ code: "auth/wrong-password" })).toBe("The email or password is incorrect.");
  });

  it("does not expose raw errors", () => {
    expect(getAuthErrorMessage(new Error("private backend detail"))).toBe("Something went wrong. Please try again.");
  });
});
