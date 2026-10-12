import React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Workspace } from "./Workspace";
import { createJokowiDemoTree } from "./demoData";
import { setLanguage } from "@/i18n";
import { setDialect } from "./canvas/dialectSetting";
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

  it("opens Semua orang, picks a person and closes the panel", async () => {
    render(<Workspace />);
    await screen.findByText("Keluarga Joko Widodo");
    fireEvent.click(screen.getByRole("button", { name: "Semua orang" }));
    const panel = screen.getByRole("dialog", { name: "Semua orang" });
    fireEvent.change(within(panel).getByRole("searchbox", { name: "Cari orang" }), { target: { value: "kaesang" } });
    fireEvent.click(within(panel).getByRole("button", { name: /Kaesang Pangarep/ }));
    expect(screen.queryByRole("dialog", { name: "Semua orang" })).not.toBeInTheDocument();
    expect(node("Kaesang Pangarep")).toHaveAttribute("aria-pressed", "true");
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

  it("starts a tree, adds a relative with the wizard and edits a profile", async () => {
    await openEmptyTree();
    fireEvent.click(screen.getByRole("button", { name: /Tambah anggota keluarga/ }));
    fireEvent.change(screen.getByRole("textbox", { name: "Nama" }), { target: { value: "Budi Santoso" } });
    fireEvent.click(screen.getByRole("button", { name: "Tambah orang" }));
    expect(node("Budi Santoso")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Tampilan pohon: Fokus keluarga · Budi Santoso" })).toBeInTheDocument();
    expect(screen.queryByText("Orang terpilih")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Tambah kerabatnya Budi Santoso" }));
    fireEvent.click(screen.getByRole("button", { name: /Bikin orang baru/ }));
    fireEvent.click(screen.getByRole("button", { name: "Istri" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Nama" }), { target: { value: "Sari Wulandari" } });
    fireEvent.click(screen.getByRole("button", { name: "Tambah anggota keluarga" }));
    // Like heritg.us the person you started from stays selected, and the new wife is labelled.
    expect(node("Budi Santoso")).toHaveAttribute("aria-pressed", "true");
    expect(node("Sari Wulandari")).toHaveAttribute("aria-label", "Sari Wulandari, Perempuan");
    expect(screen.getByText("Orang terpilih")).toBeInTheDocument();
    expect(screen.getByText("Istri")).toBeInTheDocument();
    expect(screen.getByText("2 orang · 1 hubungan")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Edit profil Budi Santoso" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Gender" }), { target: { value: "male" } });
    fireEvent.click(screen.getByRole("button", { name: "Simpan" }));
    expect(node("Budi Santoso")).toHaveAttribute("aria-label", "Budi Santoso, Laki-laki");
    fireEvent.click(node("Sari Wulandari"));
    expect(screen.getByText("Suami")).toBeInTheDocument();
  });

  it("does not show coach marks once the tree has people", async () => {
    render(<Workspace />);
    await screen.findByText("Keluarga Joko Widodo");
    expect(screen.queryByText("Bagikan · Setelan")).not.toBeInTheDocument();
    expect(screen.getByText("20 orang · 31 hubungan")).toBeInTheDocument();
  });
});

describe("Workspace settings panel", () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => { cleanup(); setLanguage("id"); setDialect("id"); window.localStorage.clear(); });

  it("changes kinship labels on the canvas when a dialect is chosen", async () => {
    render(<Workspace />);
    await screen.findByText("Keluarga Joko Widodo");
    fireEvent.click(node("Joko Widodo"));
    expect(screen.getAllByText("Istri").length).toBeGreaterThanOrEqual(1);
    fireEvent.click(screen.getByRole("button", { name: "Setelan" }));
    const panel = screen.getByRole("dialog", { name: "Setelan" });
    fireEvent.click(within(panel).getAllByRole("button", { name: "English" })[1]);
    expect(screen.getAllByText("Wife").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText("Istri")).not.toBeInTheDocument();
  });
});

describe("Workspace help and privacy panels", () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => { cleanup(); setLanguage("id"); window.localStorage.clear(); });

  it("opens Bantuan from its chrome button", async () => {
    render(<Workspace />);
    await screen.findByText("Keluarga Joko Widodo");
    fireEvent.click(screen.getByRole("button", { name: "Bantuan" }));
    expect(within(screen.getByRole("dialog", { name: "Bantuan" })).getAllByRole("heading", { level: 3 })).toHaveLength(6);
  });

  it("opens Perlindungan privasi from the chip and flips the masking toggle", async () => {
    render(<Workspace />);
    await screen.findByText("Keluarga Joko Widodo");
    fireEvent.click(screen.getByRole("button", { name: /Perlindungan privasi/ }));
    const panel = screen.getByRole("dialog", { name: "Perlindungan privasi" });
    const toggle = within(panel).getByRole("button", { name: "Samarkan tanggal dan foto di daftar" });
    const before = toggle.getAttribute("aria-pressed");
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-pressed")).not.toBe(before);
  });
});
