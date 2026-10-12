import React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Workspace } from "./Workspace";
import { createJokowiDemoTree } from "./demoData";
import { setLanguage } from "@/i18n";
import { setDialect } from "./canvas/dialectSetting";
import { LocalTreeCache } from "./repository/LocalTreeCache";
import { encryptText } from "./domain/secureFile";
import { exportTree, newTree } from "./model";

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
    fireEvent.click(screen.getByRole("button", { name: /^Tampilan pohon:/ })); // choosing a view closes the popover
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
    expect(within(panel).getByText("Lahir 21 Juni 1961")).toBeInTheDocument();
    expect(within(panel).getByText("Orang tua")).toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: "Widjiatno Notomihardjo" })).toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: "Iriana Joko Widodo" })).toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: "Kaesang Pangarep" })).toBeInTheDocument();
    expect(within(panel).queryByRole("button", { name: /ubah detail/i })).not.toBeInTheDocument();
    expect(within(panel).queryByRole("button", { name: /hapus orang ini/i })).not.toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: /mulai silsilahmu sendiri/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Tambah anggota keluarga" })).not.toBeInTheDocument();
  });

  it("opens Bagikan / Ekspor for the example tree and downloads a backup", async () => {
    const create = vi.fn(() => "blob:x"), revoke = vi.fn();
    Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    render(<Workspace />);
    await screen.findByText("Keluarga Joko Widodo");
    fireEvent.click(screen.getByRole("button", { name: "Bagikan silsilah" }));
    const panel = screen.getByRole("dialog", { name: "Bagikan / Ekspor silsilah" });
    expect(within(panel).getByText("Ada 20 orang di silsilah ini")).toBeInTheDocument();
    fireEvent.click(within(panel).getByRole("button", { name: /^Bikin Link Web/ }));
    expect(within(panel).getByText(/nggak bisa dibagikan/)).toBeInTheDocument();
    fireEvent.click(within(panel).getByRole("button", { name: /^File Backup HERITG/ }));
    fireEvent.click(within(panel).getByRole("button", { name: "Download .heritg" }));
    await vi.waitFor(() => expect(click).toHaveBeenCalledTimes(1));
    expect(create).toHaveBeenCalledTimes(1);
    click.mockRestore();
  });

  it("explains the disabled branch count button with a tooltip", async () => {
    render(<Workspace />);
    await screen.findByText("Keluarga Joko Widodo");
    const button = screen.getByRole("button", { name: "Jumlah turunan cabang" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("title", "Segera hadir");
  });

  it("keeps accessible names on the icon-only top bar buttons", async () => {
    render(<Workspace />);
    await screen.findByText("Keluarga Joko Widodo");
    for (const name of ["Heritg Family+", "Bagikan silsilah", "Setelan", "Bantuan"]) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    }
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

describe("Workspace sidebar", () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => { cleanup(); setLanguage("id"); window.localStorage.clear(); });

  const openSidebar = async () => {
    render(<Workspace />);
    await screen.findByText("Keluarga Joko Widodo");
    fireEvent.click(screen.getByRole("button", { name: "Lihat kumpulan silsilah" }));
    return screen.getByRole("complementary", { name: "Silsilah keluarga" });
  };

  it("renames the active tree through the dialog, from the title pencil", async () => {
    await openSidebar();
    fireEvent.click(screen.getByRole("button", { name: "Silsilah Keluarga Saya: Atur Silsilah" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Ubah nama" }));
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
    const dialog = screen.getByRole("dialog", { name: "Ubah nama silsilah" });
    fireEvent.change(within(dialog).getByRole("textbox", { name: "Nama silsilah keluarga" }), { target: { value: "Keluarga Budi" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Simpan" }));
    expect(screen.getByRole("heading", { name: "Keluarga Budi" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Ubah nama silsilah" }));
    const again = screen.getByRole("dialog", { name: "Ubah nama silsilah" });
    expect(within(again).getByRole("textbox", { name: "Nama silsilah keluarga" })).toHaveValue("Keluarga Budi");
    fireEvent.click(within(again).getByRole("button", { name: "Batal" }));
    expect(screen.queryByRole("dialog", { name: "Ubah nama silsilah" })).not.toBeInTheDocument();
  });

  it("copies the example tree into an editable tree that becomes active", async () => {
    await openSidebar();
    fireEvent.click(screen.getByRole("button", { name: "Keluarga Joko Widodo: Atur Silsilah" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Bikin salinan keluarga" }));
    expect(await screen.findByRole("heading", { name: "Keluarga Joko Widodo (salinan)" })).toBeInTheDocument();
    expect(screen.getByText("20 orang · 31 hubungan")).toBeInTheDocument();
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
    // An editable copy: the pencil and the add button are back.
    expect(screen.getByRole("button", { name: "Ubah nama silsilah" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Lihat kumpulan silsilah" }));
    expect(screen.getByRole("button", { name: /^Keluarga Joko Widodo \(salinan\) ?[0-9]/ })).toHaveAttribute("aria-current", "true");
  });

  it("opens Perlindungan privasi and Bantuan from the sidebar rows and closes the sidebar", async () => {
    let aside = await openSidebar();
    fireEvent.click(within(aside).getByRole("button", { name: /Perlindungan privasi/ }));
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Perlindungan privasi" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Lihat kumpulan silsilah" }));
    aside = screen.getByRole("complementary", { name: "Silsilah keluarga" });
    fireEvent.click(within(aside).getByRole("button", { name: /^Bantuan/ }));
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Bantuan" })).toBeInTheDocument();
  });

  it("opens the Family+ dialog from the gradient row", async () => {
    const aside = await openSidebar();
    fireEvent.click(within(aside).getByRole("button", { name: /Heritg Family\+/ }));
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Heritg Family+" })).toBeInTheDocument();
  });

  it("opens the Family+ dialog from the top bar and closes it with Mengerti", async () => {
    render(<Workspace />);
    await screen.findByText("Keluarga Joko Widodo");
    fireEvent.click(screen.getByRole("button", { name: "Heritg Family+" }));
    expect(screen.getByRole("dialog", { name: "Heritg Family+" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Masuk" })).toHaveAttribute("href", "/login");
    fireEvent.click(screen.getByRole("button", { name: "Mengerti" }));
    expect(screen.queryByRole("dialog", { name: "Heritg Family+" })).not.toBeInTheDocument();
  });
});

describe("Workspace opening a password-protected backup", () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(cleanup);

  it("asks for the password, rejects a wrong one and imports the tree with the right one", async () => {
    const { container } = render(<Workspace />);
    await screen.findByText("Keluarga Joko Widodo");
    const secretTree = { ...newTree("Rahasia Keluarga"), people: [{ id: "p1", firstName: "Siti", lastName: "", gender: "female" as const }] };
    const envelope = await encryptText(exportTree(secretTree as never), "Sandi#1234", { iterations: 100_000 });
    const body = JSON.stringify(envelope);
    const file = new File([body], "rahasia.heritg", { type: "application/json" });
    if (typeof file.text !== "function") Object.defineProperty(file, "text", { value: async () => body }); // older jsdom lacks Blob.text
    fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [file] } });
    const dialog = await screen.findByRole("dialog", { name: "Buka file terkunci" });
    fireEvent.change(within(dialog).getByLabelText("Password"), { target: { value: "salah" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Buka" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Password salah");
    expect(screen.queryByText(/Rahasia Keluarga/)).not.toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText("Password"), { target: { value: "Sandi#1234" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Buka" }));
    expect(await screen.findByText("Rahasia Keluarga (Impor)")).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Buka file terkunci" })).not.toBeInTheDocument();
  });
});

describe("Workspace Kipas view", () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(cleanup);

  const openKipas = async () => {
    render(<Workspace />);
    await screen.findByText("Keluarga Joko Widodo");
    fireEvent.click(node("Joko Widodo"));
    fireEvent.click(screen.getByRole("button", { name: /^Tampilan pohon:/ }));
    fireEvent.click(screen.getByRole("button", { name: "Kipas" }));
  };
  const segment = (name: RegExp) => screen.getByRole("button", { name });

  it("shows the heading and the selected person at the centre", async () => {
    await openKipas();
    expect(screen.getByRole("heading", { name: "Kipas" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Tampilan pohon:/ }));
    expect(screen.getByRole("button", { name: "Kipas" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("region", { name: "Orang tua dan anak" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Bagan kipas Joko Widodo" })).toBeInTheDocument();
    expect(document.querySelector('[aria-current="true"][aria-label="Joko Widodo"]')).not.toBeNull();
    expect(screen.queryByRole("button", { name: "Perbesar" })).not.toBeInTheDocument();
  });

  it("re-roots on a parent segment, and Kembali returns", async () => {
    await openKipas();
    const back = screen.getByRole("button", { name: "Kembali" });
    expect(back).toBeDisabled();
    fireEvent.click(segment(/^Widjiatno Notomihardjo · Orang tua dari Joko Widodo$/));
    expect(screen.getByRole("group", { name: "Bagan kipas Widjiatno Notomihardjo" })).toBeInTheDocument();
    expect(back).toBeEnabled();
    fireEvent.click(back);
    expect(screen.getByRole("group", { name: "Bagan kipas Joko Widodo" })).toBeInTheDocument();
    expect(back).toBeDisabled();
  });

  it("re-roots with the keyboard", async () => {
    await openKipas();
    fireEvent.keyDown(segment(/^Widjiatno Notomihardjo · /), { key: "Enter" });
    expect(screen.getByRole("group", { name: "Bagan kipas Widjiatno Notomihardjo" })).toBeInTheDocument();
    fireEvent.keyDown(segment(/^Joko Widodo · Anak dari Widjiatno Notomihardjo$/), { key: " " });
    expect(screen.getByRole("group", { name: "Bagan kipas Joko Widodo" })).toBeInTheDocument();
  });

  it("changes the number of rings with Generasi", async () => {
    await openKipas();
    const ancestors = () => screen.queryAllByRole("button", { name: / · (Orang tua|Kakek\/Nenek|Leluhur) dari / }).length;
    const three = ancestors();
    fireEvent.change(screen.getByLabelText("Generasi"), { target: { value: "1" } });
    expect(ancestors()).toBeLessThan(three);
    fireEvent.change(screen.getByLabelText("Generasi"), { target: { value: "5" } });
    expect(ancestors()).toBeGreaterThanOrEqual(three);
  });

  it("keeps the example read-only and returns to the previous view", async () => {
    await openKipas();
    expect(screen.queryByRole("button", { name: /^Tambah kerabatnya/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Edit profil/ })).not.toBeInTheDocument();
    expect(screen.getByText("3 anak")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Kembali ke pohon" }));
    expect(screen.queryByRole("heading", { name: "Kipas" })).not.toBeInTheDocument();
    expect(node("Joko Widodo")).toHaveAttribute("aria-pressed", "true");
  });

  it("re-roots from Semua orang", async () => {
    await openKipas();
    fireEvent.click(screen.getByRole("button", { name: "Semua orang" }));
    fireEvent.click(within(screen.getByRole("dialog", { name: "Semua orang" })).getByRole("button", { name: /Kaesang Pangarep/ }));
    expect(screen.getByRole("group", { name: "Bagan kipas Kaesang Pangarep" })).toBeInTheDocument();
  });

  it("shows a visible label on every placeholder segment, with the full text in its title", async () => {
    await openKipas();
    fireEvent.click(segment(/^Widjiatno Notomihardjo · /));
    const placeholders = [...document.querySelectorAll('g[role="img"][aria-label^="Belum tercatat"]')];
    expect(placeholders.length).toBeGreaterThan(0);
    for (const placeholder of placeholders) {
      expect(placeholder.querySelector("text")!.textContent).toMatch(/^(Belum tercatat|[?])$/);
      expect(placeholder.querySelector("title")!.textContent).toMatch(/^Belum tercatat · /);
    }
    expect(placeholders.some(placeholder => placeholder.querySelector("text")!.textContent === "Belum tercatat")).toBe(true);
  });

  it("closes the view popover after choosing Kipas and never opens the example person panel", async () => {
    await openKipas();
    expect(screen.queryByRole("group", { name: "Tampilan pohon" })).not.toBeInTheDocument();
    expect(screen.queryByText("Silsilah contoh")).not.toBeInTheDocument();
    fireEvent.click(segment(/^Widjiatno Notomihardjo · /));
    expect(screen.queryByText("Silsilah contoh")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Semua orang" }));
    fireEvent.click(within(screen.getByRole("dialog", { name: "Semua orang" })).getByRole("button", { name: /Kaesang Pangarep/ }));
    expect(screen.queryByText("Silsilah contoh")).not.toBeInTheDocument();
  });
});
