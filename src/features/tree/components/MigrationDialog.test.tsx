import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { planMigration } from "../migration/planMigration";
import { MigrationDialog } from "./MigrationDialog";

const plan = planMigration({ version: 1, activeTreeId: "tree", trees: [{ id: "tree", name: "My family", updatedAt: "2026-01-01T00:00:00.000Z", people: [{ id: "person", name: "A", gender: "unspecified", birthDate: "", deathDate: "", birthOrder: null, residence: "", notes: "", photoUrl: "", photo: "data:image/png;base64,a" }], relationships: [] }] }, { remoteIdsByLocalId: {}, completedTreeIds: [] }, { ownerId: "owner", idFactory: () => "remote" });

describe("MigrationDialog", () => {
  afterEach(cleanup);
  it("shows selection, counts, and excluded photo warning", () => {
    render(<MigrationDialog plan={plan} onMigrate={vi.fn()} onPostpone={vi.fn()} />);
    expect(screen.getByRole("checkbox", { name: /my family/i })).toBeChecked();
    expect(screen.getByText(/1 embedded photo/i)).toBeVisible();
    expect(screen.getByLabelText("Migration summary")).toHaveTextContent("1 people");
  });

  it("supports postpone and safe retry", () => {
    const onPostpone = vi.fn();
    const onMigrate = vi.fn();
    render(<MigrationDialog plan={plan} result={{ completedTreeIds: [], mappings: plan.mappings, failed: [{ localTreeId: "tree", error: "offline" }] }} onMigrate={onMigrate} onPostpone={onPostpone} />);
    fireEvent.click(screen.getByRole("button", { name: "Postpone" }));
    fireEvent.click(screen.getByRole("button", { name: "Retry migration" }));
    expect(onPostpone).toHaveBeenCalledOnce();
    expect(onMigrate).toHaveBeenCalledWith(["tree"]);
    expect(screen.getByText(/safe to retry/i)).toBeVisible();
  });
});
