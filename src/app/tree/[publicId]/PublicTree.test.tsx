import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { PublicTreeSnapshot } from "@/features/tree/publishing/PublicationRepository";
import { PublicTree } from "./PublicTree";

const snapshot: PublicTreeSnapshot = {
  publicId: "public_identifier_123456",
  name: "Keluarga Uji",
  schemaVersion: 1,
  publishedRevision: 4,
  publishedAt: "2026-01-01T00:00:00.000Z",
  tree: {
    id: "public_identifier_123456",
    name: "Keluarga Uji",
    updatedAt: "2026-01-01T00:00:00.000Z",
    people: [{ id: "one", firstName: "Budi", lastName: "Uji", gender: "male", birthDate: "1980-01-01", deathDate: "", notes: "A note", photoUrl: "" }],
    relationships: [],
  },
};

describe("PublicTree", () => {
  it("renders a public snapshot without editing controls", async () => {
    render(<PublicTree publicId={snapshot.publicId} loader={vi.fn(async () => snapshot)} />);
    expect(await screen.findByText("Budi Uji")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByText(/edit/i)).not.toBeInTheDocument();
  });

  it("uses one generic unavailable state for inaccessible links", async () => {
    render(<PublicTree publicId="missing_public_identifier" loader={vi.fn(async () => null)} />);
    await waitFor(() => expect(screen.getByText("This family tree is unavailable")).toBeInTheDocument());
  });
});
