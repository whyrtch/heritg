import { describe, expect, it } from "vitest";
import { isFirebaseConfigured } from "./config";

describe("Firebase configuration", () => {
  it("reports missing Firebase configuration without throwing during build", () => {
    expect(isFirebaseConfigured({})).toBe(false);
  });

  it("accepts the complete public web configuration", () => {
    expect(isFirebaseConfigured({
      apiKey: "api-key",
      authDomain: "project.firebaseapp.com",
      projectId: "project",
      appId: "app-id",
      messagingSenderId: "sender-id"
    })).toBe(true);
  });

  it("does not require an optional Storage bucket", () => {
    expect(isFirebaseConfigured({
      apiKey: "api-key",
      authDomain: "project.firebaseapp.com",
      projectId: "project",
      appId: "app-id",
      messagingSenderId: "sender-id",
      storageBucket: undefined
    })).toBe(true);
  });
});
