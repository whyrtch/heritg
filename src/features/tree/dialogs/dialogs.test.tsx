import React, { useState } from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { addRelationship, emptyPerson, newTree, type FamilyTree } from "../model";
import { AddRelativeWizard } from "./AddRelativeWizard";
import { DatePicker } from "./DatePicker";
import { EditProfileDialog } from "./EditProfileDialog";
import { StartDialog } from "./StartDialog";

afterEach(cleanup);

const family = (): FamilyTree => {
  const tree: FamilyTree = { ...newTree(), people: [{ ...emptyPerson(), id: "budi", name: "Budi Santoso", gender: "male" }, { ...emptyPerson(), id: "sari", name: "Sari Wulandari", gender: "female" }] };
  return addRelationship(tree, "partner", "budi", "sari");
};
const nameInput = () => screen.getByRole("textbox", { name: "Nama" });

describe("StartDialog", () => {
  it("adds the first person once a name is typed", () => {
    const onSave = vi.fn();
    render(<StartDialog onClose={vi.fn()} onSave={onSave} />);
    expect(screen.getByRole("dialog", { name: "Mulai bikin silsilah" })).toBeInTheDocument();
    const submit = screen.getByRole("button", { name: "Tambah orang" });
    expect(submit).toBeDisabled();
    fireEvent.change(nameInput(), { target: { value: "  Budi Santoso " } });
    fireEvent.click(submit);
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ name: "Budi Santoso" }));
  });

  it("asks \"Batal simpan?\" before throwing away typed input", () => {
    const onClose = vi.fn();
    render(<StartDialog onClose={onClose} onSave={vi.fn()} />);
    fireEvent.change(nameInput(), { target: { value: "Budi" } });
    fireEvent.click(screen.getByRole("button", { name: "Tutup" }));
    const confirm = screen.getByRole("dialog", { name: "Batal simpan?" });
    fireEvent.click(within(confirm).getByRole("button", { name: "Batal" }));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.keyDown(nameInput(), { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: "Buang editan" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes straight away when nothing was typed", () => {
    const onClose = vi.fn();
    render(<StartDialog onClose={onClose} onSave={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Tutup" }));
    expect(onClose).toHaveBeenCalled();
    expect(screen.queryByText("Batal simpan?")).not.toBeInTheDocument();
  });
});

describe("AddRelativeWizard", () => {
  it("disables connecting when nobody else exists", () => {
    const tree: FamilyTree = { ...newTree(), people: [{ ...emptyPerson(), id: "solo", name: "Solo" }] };
    render(<AddRelativeWizard tree={tree} anchorId="solo" onClose={vi.fn()} onSubmit={vi.fn()} />);
    expect(screen.getByRole("dialog", { name: "Tambah kerabatnya Solo" })).toBeInTheDocument();
    expect(screen.getByText("Langkah 1 dari 3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Sambungin ke kerabat yang udah ada/ })).toBeDisabled();
    expect(screen.getByText(/Belum ada orang lain di silsilah ini/)).toBeInTheDocument();
  });

  it("creates a new wife with a wedding date in three steps", () => {
    const onSubmit = vi.fn();
    const tree = { ...newTree(), people: [{ ...emptyPerson(), id: "budi", name: "Budi", gender: "male" as const }, { ...emptyPerson(), id: "lain", name: "Lain" }] };
    render(<AddRelativeWizard tree={tree} anchorId="budi" onClose={vi.fn()} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole("button", { name: /Bikin orang baru/ }));
    expect(screen.getByText("Orang ini siapanya Budi?")).toBeInTheDocument();
    for (const group of ["Paling sering", "Orang tua & Wali", "Suami/Istri & Pasangan", "Anak"]) expect(screen.getByRole("group", { name: group })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Istri" }));
    expect(screen.getByText("Profil Istri baru")).toBeInTheDocument();
    expect(screen.getByText("Tanggal nikah (opsional)")).toBeInTheDocument();
    const submit = screen.getByRole("button", { name: "Tambah anggota keluarga" });
    expect(submit).toBeDisabled();
    fireEvent.change(nameInput(), { target: { value: "Sari" } });
    fireEvent.click(submit);
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ status: "wife", person: expect.objectContaining({ name: "Sari" }), marriedOn: "" }));
  });

  it("offers the anchor's partner as the other parent of a new child", () => {
    const onSubmit = vi.fn();
    render(<AddRelativeWizard tree={family()} anchorId="budi" onClose={vi.fn()} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole("button", { name: /Bikin orang baru/ }));
    fireEvent.click(screen.getByRole("button", { name: "Anak perempuan" }));
    expect(screen.queryByText("Tanggal nikah (opsional)")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: /Sari Wulandari/ }));
    fireEvent.change(nameInput(), { target: { value: "Ani" } });
    fireEvent.click(screen.getByRole("button", { name: "Tambah anggota keluarga" }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ status: "daughter", coParentId: "sari" }));
  });

  it("connects an existing person and shows errors from the tree", () => {
    const onSubmit = vi.fn(() => { throw new Error("This relationship would create a family cycle."); });
    const tree = { ...newTree(), people: [{ ...emptyPerson(), id: "a", name: "Andi" }, { ...emptyPerson(), id: "b", name: "Bayu" }] };
    render(<AddRelativeWizard tree={tree} anchorId="a" onClose={vi.fn()} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole("button", { name: /Sambungin ke kerabat yang udah ada/ }));
    fireEvent.click(screen.getByRole("button", { name: "Ayah" }));
    const connect = screen.getByRole("button", { name: "Sambungin" });
    expect(connect).toBeDisabled();
    fireEvent.click(screen.getByRole("radio", { name: /Bayu/ }));
    fireEvent.click(connect);
    expect(onSubmit).toHaveBeenCalledWith({ status: "father", existingId: "b", marriedOn: "" });
    expect(screen.getByRole("alert")).toHaveTextContent("family cycle");
  });
});

describe("EditProfileDialog", () => {
  it("enables Simpan only after a change and saves biodata", () => {
    const onSave = vi.fn();
    render(<EditProfileDialog tree={family()} personId="budi" onClose={vi.fn()} onSave={onSave} onDelete={vi.fn()} />);
    expect(screen.getByRole("dialog", { name: "Edit profil Budi Santoso" })).toBeInTheDocument();
    const save = screen.getByRole("button", { name: "Simpan" });
    expect(save).toBeDisabled();
    fireEvent.change(screen.getByRole("textbox", { name: "Domisili saat ini" }), { target: { value: "Solo" } });
    fireEvent.click(save);
    expect(onSave.mock.calls[0][0].people.find((p: { id: string }) => p.id === "budi").residence).toBe("Solo");
  });

  it("lists family, stages a status change and a removal until Simpan", () => {
    const onSave = vi.fn();
    render(<EditProfileDialog tree={family()} personId="budi" onClose={vi.fn()} onSave={onSave} onDelete={vi.fn()} />);
    const familyCard = screen.getByRole("region", { name: "Keluarga" });
    expect(within(familyCard).getByText("Sari Wulandari")).toBeInTheDocument();
    expect(within(familyCard).getByText("Istri")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Edit hubungan sama Sari Wulandari" }));
    expect(screen.getByText("Siapanya Budi Santoso sih Sari Wulandari ini?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Mantan istri" }));
    fireEvent.click(screen.getByRole("button", { name: "Simpan hubungan" }));
    expect(within(familyCard).getByText("Mantan istri")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Simpan" }));
    expect(onSave.mock.calls[0][0].relationships[0]).toMatchObject({ type: "partner", status: "ex" });
  });

  it("removes a link only on Simpan and confirms deleting the person", () => {
    const onSave = vi.fn(), onDelete = vi.fn();
    render(<EditProfileDialog tree={family()} personId="budi" onClose={vi.fn()} onSave={onSave} onDelete={onDelete} />);
    fireEvent.click(screen.getByRole("button", { name: "Hapus hubungan silsilah sama Sari Wulandari" }));
    expect(screen.queryByText("Sari Wulandari")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Simpan" }));
    expect(onSave.mock.calls[0][0].relationships).toEqual([]);
    fireEvent.click(screen.getByRole("button", { name: "Hapus orang ini" }));
    fireEvent.click(within(screen.getByRole("dialog", { name: "Hapus Budi Santoso?" })).getByRole("button", { name: "Hapus" }));
    expect(onDelete).toHaveBeenCalledWith("budi");
  });
});

describe("DatePicker", () => {
  function Harness({ initial = "" }: { initial?: string }) {
    const [value, setValue] = useState(initial);
    return <><DatePicker label="Tanggal lahir" value={value} onChange={setValue} /><output>{value}</output></>;
  }

  it("picks a day from the chosen month and year, and clears it", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: /Tanggal lahir Pilih tanggal/ }));
    const calendar = screen.getByRole("dialog", { name: "Tanggal lahir" });
    fireEvent.change(within(calendar).getByRole("combobox", { name: "Pilih tahun" }), { target: { value: "1961" } });
    fireEvent.change(within(calendar).getByRole("combobox", { name: "Pilih bulan" }), { target: { value: "5" } });
    fireEvent.click(within(calendar).getByRole("button", { name: "21 Juni 1961" }));
    expect(screen.getByRole("status")).toHaveTextContent("1961-06-21");
    expect(screen.getByRole("button", { name: /Tanggal lahir 21 Juni 1961/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Tanggal lahir 21 Juni 1961/ }));
    fireEvent.click(screen.getByRole("button", { name: "Hapus tanggal" }));
    expect(screen.getByRole("status")).toHaveTextContent("");
  });

  it("starts on Monday and moves between months", () => {
    render(<Harness initial="2026-10-11" />);
    fireEvent.click(screen.getByRole("button", { name: /Tanggal lahir 11 Oktober 2026/ }));
    expect(screen.getByRole("button", { name: "11 Oktober 2026" })).toHaveAttribute("aria-pressed", "true");
    // October 2026 starts on a Thursday, so the grid opens with Monday 28 September.
    const calendar = screen.getByRole("dialog", { name: "Tanggal lahir" });
    expect(within(calendar).getAllByRole("button", { name: /2026$/ })[0]).toHaveAccessibleName("28 September 2026");
    fireEvent.click(screen.getByRole("button", { name: "Bulan berikutnya" }));
    expect((screen.getByRole("combobox", { name: "Pilih bulan" }) as HTMLSelectElement).value).toBe("10");
  });
});
