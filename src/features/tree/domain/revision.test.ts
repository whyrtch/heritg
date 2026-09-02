import { describe, expect, it } from "vitest";
import { detectRevisionConflict, nextRevision } from "./revision";

describe("revision helpers", () => {
  it("increments a valid revision", () => expect(nextRevision(7)).toBe(8));
  it("rejects invalid revisions", () => expect(() => nextRevision(-1)).toThrow(/non-negative/i));
  it("detects stale expected revisions", () => {
    expect(detectRevisionConflict(3, 4)).toBe(true);
    expect(detectRevisionConflict(4, { revision: 4 })).toBe(false);
  });
});
