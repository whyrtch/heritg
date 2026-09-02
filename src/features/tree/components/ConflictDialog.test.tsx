import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createJokowiDemoTree } from "../demoData";
import { toOnlineTree } from "../domain/serialization";
import type { OnlineTree } from "../domain/onlineTypes";
import { ConflictDialog } from "./ConflictDialog";

function tree(revision: number): OnlineTree {
  const { excludedDataUrlPhotoIds, ...online } = toOnlineTree(createJokowiDemoTree(), { ownerId: "owner", revision });
  void excludedDataUrlPhotoIds;
  return online;
}

describe("ConflictDialog", () => {
  it("communicates backup behavior and the second replace confirmation", () => {
    const replace = vi.fn();
    const { rerender } = render(<ConflictDialog conflict={{ local: tree(2), remote: tree(3) }} replaceConfirmationRequired={false} onKeepRemote={vi.fn()} onReplaceRemote={replace} />);
    expect(screen.getByText(/downloads your local work/i)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: /replace online with my version/i }));
    expect(replace).toHaveBeenCalledOnce();

    rerender(<ConflictDialog conflict={{ local: tree(2), remote: tree(3) }} replaceConfirmationRequired onKeepRemote={vi.fn()} onReplaceRemote={replace} />);
    expect(screen.getByRole("button", { name: /confirm replacing online version/i })).toBeVisible();
  });
});
