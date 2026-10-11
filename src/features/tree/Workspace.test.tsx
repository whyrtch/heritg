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
    expect(screen.getByText("Contoh silsilah, cuma bisa dilihat")).toBeInTheDocument();
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
    expect(screen.queryByRole("button", { name: "Tambah anggota keluarga" })).not.toBeInTheDocument();
  });

  it("restores the canonical example even if an old edited copy is cached", async () => {
    const edited = createJokowiDemoTree();
    new LocalTreeCache(window.localStorage).saveWorkspace({ version: 1, activeTreeId: edited.id, trees: [{ ...edited, name: "Edited copy", people: edited.people.slice(0, 1), relationships: [] }] });
    render(<Workspace />);
    await screen.findByText("Keluarga Joko Widodo");
    expect(screen.getAllByRole("button").filter(button => button.className.includes("personCard"))).toHaveLength(20);
  });
});

describe("Workspace shell (heritg.us parity)", () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(cleanup);

  const openEmptyTree = async () => {
    render(<Workspace />);
    await screen.findByText("Keluarga Joko Widodo");
    fireEvent.click(screen.getByRole("button", { name: "Lihat kumpulan silsilah" }));
    fireEvent.click(screen.getAllByRole("button").find(button => button.textContent?.trim().startsWith("My Family Tree"))!);
    await screen.findByText("Mulai dari siapa aja bebas");
  };

  it("shows the empty state copy and the four coach marks on an empty tree", async () => {
    await openEmptyTree();
    expect(screen.getByText("Tambah anggota keluarga")).toBeInTheDocument();
    for (const hint of ["Buka, impor, dan atur daftar silsilahmu", "Bagikan · Setelan", "Pilih keluarga terfokus atau seluruh silsilah", "Cari orang · saring generasi · zoom · pas ke layar"]) {
      expect(screen.getByText(hint)).toBeInTheDocument();
    }
  });

  it("hides every control except the eye toggle", async () => {
    await openEmptyTree();
    fireEvent.click(screen.getByRole("button", { name: "Sembunyikan kontrol" }));
    expect(screen.queryByRole("button", { name: "Setelan" })).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Kontrol layar" })).not.toBeInTheDocument();
    expect(screen.queryByText("Bagikan · Setelan")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tampilkan kontrol" }));
    expect(screen.getByRole("button", { name: "Setelan" })).toBeInTheDocument();
  });

  it("does not show coach marks once the tree has people", async () => {
    render(<Workspace />);
    await screen.findByText("Keluarga Joko Widodo");
    expect(screen.queryByText("Bagikan · Setelan")).not.toBeInTheDocument();
    expect(screen.getByText("20 orang · 31 hubungan")).toBeInTheDocument();
  });
});
