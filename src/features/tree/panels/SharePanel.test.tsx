import React from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { OnlineTree } from "../domain/onlineTypes";
import type { PublicationRepository } from "../publishing/PublicationRepository";
import { SharePanel } from "./SharePanel";

const tree: OnlineTree = {
  id: "tree-one", ownerId: "owner", name: "Family", visibility: "private", publicId: null,
  revision: 1, schemaVersion: 1, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
  publishedRevision: null, people: [], relationships: [],
};
const repository: PublicationRepository = { publish: vi.fn(), disable: vi.fn(), loadPublic: vi.fn(async () => null), getPublication: vi.fn(async () => null) };

function setup(overrides: Partial<React.ComponentProps<typeof SharePanel>> = {}) {
  const props = { treeName: "Keluarga Saya", peopleCount: 3, example: false, signedIn: false, publishing: null, onDownload: vi.fn(), onDownloadGedcom: vi.fn(), onDownloadImage: vi.fn(async () => {}), onClose: vi.fn(), ...overrides };
  render(<SharePanel {...props} />);
  return props;
}
const method = (name: string) => screen.getByRole("button", { name: new RegExp(`^${name}`) });

describe("SharePanel", () => {
  afterEach(cleanup);

  it("opens for a local-only tree on the backup method, with the scope card", () => {
    setup();
    const panel = screen.getByRole("dialog", { name: "Bagikan / Ekspor silsilah" });
    expect(within(panel).getByText("Keluarga Saya")).toBeInTheDocument();
    expect(within(panel).getByText("Ada 3 orang di silsilah ini")).toBeInTheDocument();
    expect(within(panel).getByRole("group", { name: "Mau bagikan apa?" })).toBeInTheDocument();
    expect(method("File Backup HERITG")).toHaveAttribute("aria-pressed", "true");
    expect(method("File Backup HERITG")).toHaveAttribute("aria-controls", "share-method-details");
    expect(screen.getByText("Paling disarankan")).toBeInTheDocument();
  });

  it("switches the details card per method", () => {
    setup();
    fireEvent.click(method("File GEDCOM"));
    expect(method("File GEDCOM")).toHaveAttribute("aria-pressed", "true");
    expect(method("File Backup HERITG")).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText("Buat aplikasi lain")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Download .heritg" })).not.toBeInTheDocument();
    fireEvent.click(method("Simpan Gambar"));
    expect(screen.getByText(/File gambar tidak diberi kunci/)).toBeInTheDocument();
  });

  it("downloads the backup", () => {
    const props = setup();
    fireEvent.click(screen.getByRole("button", { name: "Download .heritg" }));
    expect(props.onDownload).toHaveBeenCalledTimes(1);
  });

  it("downloads the image as PNG or SVG with the chosen options", async () => {
    const props = setup();
    fireEvent.click(method("Simpan Gambar"));
    fireEvent.click(screen.getByRole("button", { name: "Download PNG HD" }));
    await waitFor(() => expect(props.onDownloadImage).toHaveBeenLastCalledWith("png", { dates: true, photos: true }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Foto profil" }));
    fireEvent.click(screen.getByRole("button", { name: "Download SVG" }));
    await waitFor(() => expect(props.onDownloadImage).toHaveBeenLastCalledWith("svg", { dates: true, photos: false }));
  });

  it("disables the image buttons for an empty tree and shows a friendly error on failure", async () => {
    setup({ peopleCount: 0 });
    fireEvent.click(method("Simpan Gambar"));
    expect(screen.getByRole("button", { name: "Download PNG HD" })).toBeDisabled();
    cleanup();
    setup({ onDownloadImage: vi.fn(async () => { throw new Error("x"); }) });
    fireEvent.click(method("Simpan Gambar"));
    fireEvent.click(screen.getByRole("button", { name: "Download SVG" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Gambar belum bisa dibuat");
  });

  it("downloads GEDCOM with the chosen privacy options", () => {
    const props = setup();
    fireEvent.click(method("File GEDCOM"));
    expect(screen.getByText("Yang ikut di file")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Download GEDCOM" }));
    expect(props.onDownloadGedcom).toHaveBeenLastCalledWith({ dates: true, marriageDates: true });
    fireEvent.click(screen.getByRole("checkbox", { name: "Tanggal nikah" }));
    fireEvent.click(screen.getByRole("button", { name: "Download GEDCOM" }));
    expect(props.onDownloadGedcom).toHaveBeenLastCalledWith({ dates: true, marriageDates: false });
    fireEvent.click(screen.getByRole("checkbox", { name: "Tanggal & urutan lahir" }));
    fireEvent.click(screen.getByRole("button", { name: "Download GEDCOM" }));
    expect(props.onDownloadGedcom).toHaveBeenLastCalledWith({ dates: false, marriageDates: false });
  });

  it("explains the web link when signed out, signed in but not synced, and for the example tree", () => {
    setup();
    fireEvent.click(method("Bikin Link Web"));
    expect(screen.getByText(/Masuk dulu buat bikin link web/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Masuk" })).toHaveAttribute("href", "/login");
    cleanup();
    setup({ signedIn: true });
    fireEvent.click(method("Bikin Link Web"));
    expect(screen.getByText("Link web butuh silsilah yang sudah online di akunmu")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Bikin link" })).not.toBeInTheDocument();
    cleanup();
    setup({ example: true, signedIn: true });
    fireEvent.click(method("Bikin Link Web"));
    expect(screen.getByText(/nggak bisa dibagikan lewat link web/)).toBeInTheDocument();
  });

  it("shows the publish UI inline, selected by default, only for a synced tree", () => {
    setup({ signedIn: true, publishing: { tree, repository, onTreeChange: vi.fn() } });
    expect(method("Bikin Link Web")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Bikin link" })).toBeInTheDocument();
    expect(screen.getByText(/Siapa pun yang punya link ini/i)).toBeInTheDocument();
  });

  describe("backup password", () => {
    const download = () => screen.getByRole("button", { name: "Download .heritg" });
    const pw = (value: string) => fireEvent.change(screen.getByLabelText("Password backup (opsional)"), { target: { value } });
    const confirm = (value: string) => fireEvent.change(screen.getByLabelText("Ulangi password backup"), { target: { value } });

    it("downloads a plain backup when the password is empty", () => {
      const props = setup();
      expect(screen.getByText(/Kosongin kalau nggak pakai password/)).toBeInTheDocument();
      expect(screen.queryByLabelText("Ulangi password backup")).not.toBeInTheDocument();
      expect(download()).toBeEnabled();
      fireEvent.click(download());
      expect(props.onDownload).toHaveBeenCalledWith(undefined);
    });

    it("keeps the download disabled until the password passes the rules and the confirmation matches", () => {
      const props = setup();
      pw("lemah");
      expect(download()).toBeDisabled();
      expect(screen.getByRole("list", { name: "Syarat password" })).toBeInTheDocument();
      pw("Sandi#1234");
      expect(download()).toBeDisabled();
      confirm("Sandi#12");
      expect(screen.getByRole("alert")).toHaveTextContent("Password belum sama");
      expect(download()).toBeDisabled();
      confirm("Sandi#1234");
      expect(download()).toBeEnabled();
      fireEvent.click(download());
      expect(props.onDownload).toHaveBeenCalledWith("Sandi#1234");
    });

    it("shows and hides the typed password", () => {
      setup();
      const input = screen.getByLabelText("Password backup (opsional)");
      expect(input).toHaveAttribute("type", "password");
      fireEvent.click(screen.getAllByRole("button", { name: "Lihat password" })[0]);
      expect(input).toHaveAttribute("type", "text");
    });

    it("reports a backup that could not be made", async () => {
      setup({ onDownload: vi.fn(async () => { throw new Error("x"); }) });
      fireEvent.click(download());
      expect(await screen.findByRole("alert")).toHaveTextContent("File backup belum bisa dibuat");
    });
  });
});
