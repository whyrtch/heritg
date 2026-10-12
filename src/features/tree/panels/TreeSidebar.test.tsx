import React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TreeSidebar } from "./TreeSidebar";
import { createJokowiDemoTree } from "../demoData";
import { newTree } from "../model";

const mine = { ...newTree("Keluarga Budi"), updatedAt: "2026-10-11T08:00:00.000Z" };
const other = newTree("Keluarga Sari");
const demo = createJokowiDemoTree();

const setup = (overrides: Partial<React.ComponentProps<typeof TreeSidebar>> = {}) => {
  const props = { trees: [demo, mine, other], activeId: mine.id, onSelect: vi.fn(), onCreate: vi.fn(), onImport: vi.fn(), onCopy: vi.fn(), onRename: vi.fn(), onDelete: vi.fn(), onFamilyPlus: vi.fn(), onPrivacy: vi.fn(), onHelp: vi.fn(), onClose: vi.fn(), ...overrides };
  render(<TreeSidebar {...props} />);
  return props;
};

describe("TreeSidebar", () => {
  afterEach(cleanup);

  it("lists the trees, marks the active one and shows the meta line", () => {
    setup();
    const aside = screen.getByRole("complementary", { name: "Silsilah keluarga" });
    expect(within(aside).getByRole("button", { name: /^Keluarga Budi ?[0-9]/ })).toHaveAttribute("aria-current", "true");
    expect(within(aside).getByRole("button", { name: /^Keluarga Sari ?[0-9]/ })).not.toHaveAttribute("aria-current");
    expect(within(aside).getByText(`${demo.people.length} orang · contoh`)).toBeInTheDocument();
    expect(within(aside).getByText("0 orang · 11 Okt")).toBeInTheDocument();
  });

  it("filters the tree cards by name", () => {
    setup();
    fireEvent.change(screen.getByRole("searchbox", { name: "Cari silsilah" }), { target: { value: "sari" } });
    expect(screen.getByRole("button", { name: /^Keluarga Sari ?[0-9]/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Keluarga Budi ?[0-9]/ })).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole("searchbox", { name: "Cari silsilah" }), { target: { value: "zzz" } });
    expect(screen.getByText("Nggak ada silsilah yang cocok")).toBeInTheDocument();
  });

  it("opens a kebab menu: copy and rename for a normal tree, only copy for the example", () => {
    const props = setup();
    const kebab = screen.getByRole("button", { name: "Keluarga Budi: Atur Silsilah" });
    expect(kebab).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(kebab);
    expect(kebab).toHaveAttribute("aria-expanded", "true");
    expect(screen.getAllByRole("menuitem").map(item => item.textContent)).toEqual(["Bikin salinan keluarga", "Ubah nama", "Hapus"]);
    fireEvent.click(screen.getByRole("menuitem", { name: "Ubah nama" }));
    expect(props.onRename).toHaveBeenCalledWith(mine);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    fireEvent.click(kebab);
    fireEvent.click(screen.getByRole("menuitem", { name: "Hapus" }));
    expect(props.onDelete).toHaveBeenCalledWith(mine);

    fireEvent.click(screen.getByRole("button", { name: "Keluarga Joko Widodo: Atur Silsilah" }));
    expect(screen.getAllByRole("menuitem").map(item => item.textContent)).toEqual(["Bikin salinan keluarga"]);
    fireEvent.click(screen.getByRole("menuitem", { name: "Bikin salinan keluarga" }));
    expect(props.onCopy).toHaveBeenCalledWith(demo);
  });

  it("closes the menu on Escape (not the sidebar) and on an outside click, returning focus to the kebab", () => {
    const props = setup();
    const kebab = screen.getByRole("button", { name: "Keluarga Budi: Atur Silsilah" });
    fireEvent.click(kebab);
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(kebab).toHaveFocus();
    expect(props.onClose).not.toHaveBeenCalled();
    fireEvent.click(kebab);
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it("closes on the backdrop and the Tutup button, and wires the actions and menu rows", () => {
    const props = setup();
    fireEvent.mouseDown(screen.getByRole("complementary").parentElement!);
    expect(props.onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Tutup" }));
    expect(props.onClose).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getAllByRole("button", { name: "Silsilah baru" })[0]);
    fireEvent.click(screen.getByRole("button", { name: "Impor file" }));
    expect(screen.queryByRole("button", { name: "Ekspor file" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Heritg Family\+/ }));
    fireEvent.click(screen.getByRole("button", { name: /Perlindungan privasi/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Bantuan/ }));
    for (const key of ["onCreate", "onImport", "onFamilyPlus", "onPrivacy", "onHelp"] as const) expect(props[key]).toHaveBeenCalledTimes(1);
  });
});
