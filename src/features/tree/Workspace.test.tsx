import React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Workspace } from "./Workspace";
import { createJokowiDemoTree } from "./demoData";
import { LocalTreeCache } from "./repository/LocalTreeCache";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));
vi.mock("@/features/auth/useAuth", () => ({ useAuth: () => ({ user: null, status: "unauthenticated", signOut: vi.fn() }) }));

const card = (name: string) => screen.getAllByRole("button").find(button => button.className.includes("personCard") && button.textContent?.includes(name))!;

describe("Workspace with the example tree", () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(cleanup);

  it("shows years on the example tree even though dates are hidden by default", async () => {
    render(<Workspace />);
    expect(await screen.findByText("Keluarga Joko Widodo")).toBeInTheDocument();
    expect(within(card("Joko Widodo")).getByText("Born 1961")).toBeInTheDocument();
    expect(screen.getByText("Example tree, view only")).toBeInTheDocument();
  });

  it("opens read-only details with relatives and no editing controls", async () => {
    render(<Workspace />);
    await screen.findByText("Keluarga Joko Widodo");
    fireEvent.click(card("Joko Widodo"));
    const panel = screen.getByRole("heading", { name: "Joko Widodo" }).closest("aside")!;
    expect(within(panel).getByText("Born 21 June 1961")).toBeInTheDocument();
    expect(within(panel).getByText("Parents")).toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: "Widjiatno Notomihardjo" })).toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: "Iriana Joko Widodo" })).toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: "Kaesang Pangarep" })).toBeInTheDocument();
    expect(within(panel).queryByRole("button", { name: /edit details/i })).not.toBeInTheDocument();
    expect(within(panel).queryByRole("button", { name: /delete person/i })).not.toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: /start your own tree/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add family member" })).not.toBeInTheDocument();
  });

  it("restores the canonical example even if an old edited copy is cached", async () => {
    const edited = createJokowiDemoTree();
    new LocalTreeCache(window.localStorage).saveWorkspace({ version: 1, activeTreeId: edited.id, trees: [{ ...edited, name: "Edited copy", people: edited.people.slice(0, 1), relationships: [] }] });
    render(<Workspace />);
    await screen.findByText("Keluarga Joko Widodo");
    expect(screen.getAllByRole("button").filter(button => button.className.includes("personCard"))).toHaveLength(20);
  });
});
