import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { emptyPerson, newTree, type FamilyTree } from "../model";
import { PeoplePanel } from "./PeoplePanel";
import { SidePanel } from "./SidePanel";

afterEach(cleanup);

const tree = (): FamilyTree => ({
  ...newTree(),
  people: [
    { ...emptyPerson(), id: "budi", name: "Budi Santoso", gender: "male" },
    { ...emptyPerson(), id: "sari", name: "Sari Wulandari", gender: "female", photoUrl: "https://example.com/sari.jpg" },
    { ...emptyPerson(), id: "adi", name: "Adi Nugroho" },
  ],
});
const setup = (props: Partial<React.ComponentProps<typeof PeoplePanel>> = {}) => {
  const onPick = vi.fn(), onClose = vi.fn();
  render(<PeoplePanel tree={tree()} selectedId="budi" labels={new Map([["sari", "Istri"]])} privacy={false} onPick={onPick} onClose={onClose} {...props} />);
  return { onPick, onClose };
};

describe("SidePanel", () => {
  it("is a non-modal dialog that closes with Tutup and Escape", () => {
    const onClose = vi.fn();
    render(<SidePanel title="Judul" onClose={onClose}><p>isi</p></SidePanel>);
    const dialog = screen.getByRole("dialog", { name: "Judul" });
    expect(dialog).toHaveAttribute("aria-modal", "false");
    fireEvent.click(screen.getByRole("button", { name: "Tutup" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});

describe("PeoplePanel", () => {
  it("filters by name, ignoring case", () => {
    setup();
    fireEvent.change(screen.getByRole("searchbox", { name: "Cari orang" }), { target: { value: "sARI" } });
    expect(screen.getByRole("button", { name: /Sari Wulandari/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Budi Santoso/ })).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole("searchbox", { name: "Cari orang" }), { target: { value: "zzz" } });
    expect(screen.getByText("Nggak ada yang cocok")).toBeInTheDocument();
  });

  it("shows Dipilih, the kinship label or the generic fallback", () => {
    setup();
    expect(screen.getByRole("button", { name: /Budi Santoso/ })).toHaveTextContent("Dipilih");
    expect(screen.getByRole("button", { name: /Sari Wulandari/ })).toHaveTextContent("Istri");
    expect(screen.getByRole("button", { name: /Adi Nugroho/ })).toHaveTextContent("Anggota keluarga");
  });

  it("shows photos unless privacy masking is on", () => {
    const { container } = render(<PeoplePanel tree={tree()} selectedId={null} privacy={false} onPick={vi.fn()} onClose={vi.fn()} />);
    expect(container.querySelector("img")).not.toBeNull();
    cleanup();
    const masked = render(<PeoplePanel tree={tree()} selectedId={null} privacy onPick={vi.fn()} onClose={vi.fn()} />);
    expect(masked.container.querySelector("img")).toBeNull();
  });

  it("calls onPick with the row's person and closes via Tutup or Escape", () => {
    const { onPick, onClose } = setup();
    fireEvent.click(screen.getByRole("button", { name: /Adi Nugroho/ }));
    expect(onPick).toHaveBeenCalledWith("adi");
    fireEvent.click(screen.getByRole("button", { name: "Tutup" }));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});

describe("focus return", () => {
  it("SidePanel focuses its close button on open and returns focus to the opener on close", () => {
    const opener = document.createElement("button");
    document.body.appendChild(opener); opener.focus();
    const { unmount } = render(<SidePanel title="Judul" onClose={() => {}}><p>isi</p></SidePanel>);
    expect(screen.getByRole("button", { name: "Tutup" })).toHaveFocus();
    unmount();
    expect(opener).toHaveFocus();
    opener.remove();
  });
});
