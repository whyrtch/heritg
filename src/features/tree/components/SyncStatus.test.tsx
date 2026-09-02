import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SyncStatus } from "./SyncStatus";

describe("SyncStatus", () => {
  it("announces offline persistence and exposes retry", () => {
    const retry = vi.fn();
    render(<SyncStatus status="offline" onRetry={retry} />);
    expect(screen.getByRole("status")).toHaveTextContent(/saved on this device/i);
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(retry).toHaveBeenCalledOnce();
  });
});
