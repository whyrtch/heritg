import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { OnlineTree } from "../domain/onlineTypes";
import type { PublicationRepository } from "../publishing/PublicationRepository";
import { PublishDialog } from "./PublishDialog";

const privateTree: OnlineTree = {
  id: "tree-one", ownerId: "owner", name: "Family", visibility: "private", publicId: null,
  revision: 1, schemaVersion: 1, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
  publishedRevision: null, people: [], relationships: [],
};

function mockRepository(): PublicationRepository {
  return {
    publish: vi.fn(async (tree, publicId) => ({ ...tree, visibility: "unlisted", publicId, revision: 2, publishedRevision: 2 })),
    disable: vi.fn(async tree => ({ ...tree, visibility: "private", publicId: null, revision: 3, publishedRevision: null })),
    cleanupDisabled: vi.fn(async () => undefined),
    loadPublic: vi.fn(async () => null),
  };
}

describe("PublishDialog", () => {
  it("warns about bearer-link visibility and publishes", async () => {
    const repository = mockRepository();
    const onTreeChange = vi.fn();
    render(<PublishDialog tree={privateTree} repository={repository} onTreeChange={onTreeChange} onClose={() => undefined} />);
    expect(screen.getByText(/Anyone who has this link/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Publish with link" }));
    await waitFor(() => expect(repository.publish).toHaveBeenCalledOnce());
    expect(onTreeChange).toHaveBeenCalledOnce();
  });

  it("offers copy, update, regeneration, and unpublish for an active link", () => {
    render(<PublishDialog
      tree={{ ...privateTree, visibility: "unlisted", publicId: "public_identifier_123456", publishedRevision: 1 }}
      repository={mockRepository()} onTreeChange={() => undefined} onClose={() => undefined} appUrl="https://heritg.example"
    />);
    expect(screen.getByDisplayValue("https://heritg.example/tree/public_identifier_123456")).toHaveAttribute("readonly");
    expect(screen.getByRole("button", { name: "Copy link" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Update public version" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Regenerate link" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Unpublish" })).toBeInTheDocument();
  });
});
