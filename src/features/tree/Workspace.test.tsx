import React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Workspace } from "./Workspace";
import { createJokowiDemoTree } from "./demoData";
import { LocalTreeCache } from "./repository/LocalTreeCache";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));
vi.mock("@/features/auth/useAuth", () => ({ useAuth: () => ({ user: null, status: "unauthenticated", signOut: vi.fn() }) }));

const GENDERS = /, (Laki-laki|Perempuan|Nggak disebutin)$/;
const nodeButtons = () => screen.getAllByRole("button", { name: GENDERS });
const node = (name: string) => nodeButtons().find(button => button.getAttribute("aria-label")?.startsWith(`${name}, `))!;

describe("Workspace with the example tree", () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(cleanup);

  it("draws the example tree as SVG nodes with accessible hit buttons", async () => {
    const { container } = render(<Workspace />);
    expect(await screen.findByText("Keluarga Joko Widodo")).toBeInTheDocument();
    expect(node("Joko Widodo")).toHaveAttribute("aria-label", "Joko Widodo, Laki-laki");
    expect(node("Iriana Joko Widodo")).toHaveAttribute("aria-pressed", "false");
    expect(container.querySelectorAll("[data-stage] svg text").length).toBeGreaterThanOrEqual(40);
    expect(screen.getByText("Contoh silsilah, cuma bisa dilihat")).toBeInTheDocument();
  });

  it("labels everyone relative to the selected person", async () => {
    render(<Workspace />);
    await screen.findByText("Keluarga Joko Widodo");
    fireEvent.click(node("Joko Widodo"));
    expect(node("Joko Widodo")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Orang terpilih")).toBeInTheDocument();
    expect(screen.getAllByText("Istri").length).toBeGreaterThanOrEqual(1);
    // The example tree is read-only: no edit / add dots.
    expect(screen.queryByRole("button", { name: /^Edit profil/ })).not.toBeInTheDocument();
    fireEvent.click(node("Joko Widodo"));
    expect(node("Joko Widodo")).toHaveAttribute("aria-pressed", "false");
  });

  it("switches to the Fokus view and grows it on request", async () => {
    render(<Workspace />);
    await screen.findByText("Keluarga Joko Widodo");
    fireEvent.click(node("Gibran Rakabuming Raka"));
    fireEvent.click(screen.getByRole("button", { name: "Tampilan pohon: Pohon lengkap" }));
    fireEvent.click(screen.getByRole("button", { name: "Fokus keluarga" }));
    const shown = () => nodeButtons().length;
    expect(screen.getByText(`Menampilkan ${shown()} dari 20 orang`)).toBeInTheDocument();
    const before = shown();
    expect(before).toBeLessThan(20);
    fireEvent.click(screen.getByRole("checkbox", { name: /Tampilkan saudara/ }));
    expect(shown()).toBeGreaterThan(before);
    const ancestors = screen.getByRole("button", { name: "Leluhur lainnya" });
    if (!(ancestors as HTMLButtonElement).disabled) { const count = shown(); fireEvent.click(ancestors); expect(shown()).toBeGreaterThan(count); }
    fireEvent.click(screen.getByRole("button", { name: "Pohon lengkap" }));
    expect(shown()).toBe(20);
  });

  it("opens read-only details with relatives and no editing controls", async () => {
    render(<Workspace />);
    await screen.findByText("Keluarga Joko Widodo");
    fireEvent.click(node("Joko Widodo"));
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
    expect(nodeButtons()).toHaveLength(20);
  });
});

describe("Workspace shell (heritg.us parity)", () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(cleanup);

  const openEmptyTree = async () => {
    render(<Workspace />);
    await screen.findByText("Keluarga Joko Widodo");
    fireEvent.click(screen.getByRole("button", { name: "Lihat kumpulan silsilah" }));
    fireEvent.click(screen.getAllByRole("button").find(button => button.textContent?.trim().startsWith("Silsilah Keluarga Saya"))!);
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

  it("shows edit and add dots for the selected person in an editable tree", async () => {
    await openEmptyTree();
    fireEvent.click(screen.getByRole("button", { name: /Tambah anggota keluarga/ }));
    fireEvent.change(screen.getByLabelText("Nama"), { target: { value: "Sari Dewi" } });
    fireEvent.change(screen.getByLabelText("Gender"), { target: { value: "female" } });
    fireEvent.submit(screen.getByLabelText("Nama").closest("form")!);
    expect(node("Sari Dewi")).toHaveAttribute("aria-label", "Sari Dewi, Perempuan");
    expect(node("Sari Dewi")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Tampilan pohon: Fokus keluarga · Sari Dewi" })).toBeInTheDocument();
    // A single person has nobody to be related to yet, so no relation label is drawn.
    expect(screen.queryByText("Orang terpilih")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit profil Sari Dewi" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tambah kerabatnya Sari Dewi" }));
    expect(screen.getByText("Add a relative")).toBeInTheDocument();
  });

  it("does not show coach marks once the tree has people", async () => {
    render(<Workspace />);
    await screen.findByText("Keluarga Joko Widodo");
    expect(screen.queryByText("Bagikan · Setelan")).not.toBeInTheDocument();
    expect(screen.getByText("20 orang · 31 hubungan")).toBeInTheDocument();
  });
});
