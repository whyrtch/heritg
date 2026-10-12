import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { OnlineTree } from "../domain/onlineTypes";
import type { PublicationInfo, PublicationRepository } from "../publishing/PublicationRepository";
import { PublishDialog } from "./PublishDialog";

const privateTree: OnlineTree = {
  id: "tree-one", ownerId: "owner", name: "Family", visibility: "private", publicId: null,
  revision: 1, schemaVersion: 1, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
  publishedRevision: null, people: [], relationships: [],
};
const publishedTree: OnlineTree = { ...privateTree, visibility: "unlisted", publicId: "public_identifier_123456", publishedRevision: 1 };

function mockRepository(info: PublicationInfo | null = null): PublicationRepository {
  return {
    publish: vi.fn(async (tree, publicId) => ({ ...tree, visibility: "unlisted", publicId, revision: 2, publishedRevision: 2 })),
    disable: vi.fn(async tree => ({ ...tree, visibility: "private", publicId: null, revision: 3, publishedRevision: null })),
    loadPublic: vi.fn(async () => null),
    getPublication: vi.fn(async () => info),
  };
}

describe("PublishDialog", () => {
  afterEach(cleanup);
  it("warns about bearer-link visibility and publishes with the default settings", async () => {
    const repository = mockRepository();
    const onTreeChange = vi.fn();
    render(<PublishDialog tree={privateTree} repository={repository} onTreeChange={onTreeChange} onClose={() => undefined} />);
    expect(screen.getByText(/Siapa pun yang punya link ini/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Bikin link" }));
    await waitFor(() => expect(repository.publish).toHaveBeenCalledOnce());
    expect(repository.publish).toHaveBeenCalledWith(privateTree, expect.any(String), { options: { dates: true, marriageDates: true, photos: true }, expiresInDays: null });
    expect(onTreeChange).toHaveBeenCalledOnce();
  });

  it("offers copy, update, regeneration, and unpublish for an active link", async () => {
    const repository = mockRepository();
    render(<PublishDialog tree={publishedTree} repository={repository} onTreeChange={() => undefined} onClose={() => undefined} appUrl="https://heritg.example" />);
    expect(screen.getByDisplayValue("https://heritg.example/tree/public_identifier_123456")).toHaveAttribute("readonly");
    expect(screen.getByRole("button", { name: "Salin link" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Perbarui versi publik" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Buat link baru" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cabut link" })).toBeInTheDocument();
    await waitFor(() => expect(repository.getPublication).toHaveBeenCalled());
  });

  it("sends the chosen privacy options and expiry, and notes what is always shown", async () => {
    const repository = mockRepository();
    render(<PublishDialog tree={privateTree} repository={repository} onTreeChange={() => undefined} onClose={() => undefined} />);
    expect(screen.getByText("Yang bakal kelihatan di link")).toBeInTheDocument();
    expect(screen.getByText(/selalu tampil/)).toBeInTheDocument();
    for (const name of ["Tanggal & urutan lahir", "Tanggal nikah", "Foto profil"]) expect(screen.getByRole("checkbox", { name })).toBeChecked();
    fireEvent.click(screen.getByRole("checkbox", { name: "Foto profil" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Tanggal nikah" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Masa berlaku link" }), { target: { value: "30" } });
    fireEvent.click(screen.getByRole("button", { name: "Bikin link" }));
    await waitFor(() => expect(repository.publish).toHaveBeenCalledOnce());
    expect(repository.publish).toHaveBeenCalledWith(privateTree, expect.any(String), { options: { dates: true, marriageDates: false, photos: false }, expiresInDays: 30 });
  });

  const future = () => new Date(Date.now() + 20 * 86_400_000).toISOString();
  const stored = (expiresAt: string | null = future()): PublicationInfo => ({ options: { dates: false, marriageDates: true, photos: true }, expiresAt, mode: "plain" });
  const update = () => screen.getByRole("button", { name: "Perbarui versi publik" });

  it("shows the stored settings and sends neither field on an untouched update", async () => {
    const repository = mockRepository(stored());
    render(<PublishDialog tree={publishedTree} repository={repository} onTreeChange={() => undefined} onClose={() => undefined} />);
    expect((await screen.findAllByText(/Berlaku sampai/)).length).toBeGreaterThan(0);
    expect(screen.getByRole("option", { name: /Tidak diubah · berlaku sampai/ })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("checkbox", { name: "Tanggal & urutan lahir" })).not.toBeChecked());
    await waitFor(() => expect(update()).toBeEnabled());
    fireEvent.click(update());
    await waitFor(() => expect(repository.publish).toHaveBeenCalledOnce());
    const settings = vi.mocked(repository.publish).mock.calls[0][2];
    expect(settings?.options).toBeUndefined();
    expect(settings?.expiresInDays).toBeUndefined();
  });

  it("sends options after a checkbox change and a null expiry when the owner picks no limit", async () => {
    const repository = mockRepository(stored());
    render(<PublishDialog tree={publishedTree} repository={repository} onTreeChange={() => undefined} onClose={() => undefined} />);
    await waitFor(() => expect(update()).toBeEnabled());
    fireEvent.click(screen.getByRole("checkbox", { name: "Foto profil" }));
    fireEvent.click(update());
    await waitFor(() => expect(repository.publish).toHaveBeenCalledOnce());
    const first = vi.mocked(repository.publish).mock.calls[0][2];
    expect(first?.options).toEqual({ dates: false, marriageDates: true, photos: false });
    expect(first?.expiresInDays).toBeUndefined();
    // After its own update the card reloads the stored settings (the mock still says photos on).
    await waitFor(() => expect(screen.getByRole("checkbox", { name: "Foto profil" })).toBeChecked());
    fireEvent.change(screen.getByRole("combobox", { name: "Masa berlaku link" }), { target: { value: "none" } });
    await waitFor(() => expect(update()).toBeEnabled());
    fireEvent.click(update());
    await waitFor(() => expect(repository.publish).toHaveBeenCalledTimes(2));
    expect(vi.mocked(repository.publish).mock.calls[1][2]?.expiresInDays).toBeNull();
  });

  it("keeps the stored expiry when the owner switches back to unchanged", async () => {
    const repository = mockRepository(stored());
    render(<PublishDialog tree={publishedTree} repository={repository} onTreeChange={() => undefined} onClose={() => undefined} />);
    await waitFor(() => expect(update()).toBeEnabled());
    const select = screen.getByRole("combobox", { name: "Masa berlaku link" });
    fireEvent.change(select, { target: { value: "7" } });
    fireEvent.change(select, { target: { value: "keep" } });
    fireEvent.click(update());
    await waitFor(() => expect(repository.publish).toHaveBeenCalledOnce());
    expect(vi.mocked(repository.publish).mock.calls[0][2]?.expiresInDays).toBeUndefined();
  });

  it("keeps update and regenerate disabled while the settings load or when they failed", async () => {
    let finish: (info: PublicationInfo | null) => void = () => undefined;
    const repository = mockRepository();
    repository.getPublication = vi.fn(() => new Promise<PublicationInfo | null>(resolve => { finish = resolve; }));
    render(<PublishDialog tree={publishedTree} repository={repository} onTreeChange={() => undefined} onClose={() => undefined} />);
    expect(update()).toBeDisabled();
    expect(screen.getByRole("button", { name: "Buat link baru" })).toBeDisabled();
    finish(stored());
    await waitFor(() => expect(update()).toBeEnabled());
    cleanup();
    const failing = mockRepository();
    failing.getPublication = vi.fn(async () => { throw new Error("offline"); });
    render(<PublishDialog tree={publishedTree} repository={failing} onTreeChange={() => undefined} onClose={() => undefined} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Pengaturan link belum bisa dimuat");
    expect(update()).toBeDisabled();
    expect(screen.getByRole("button", { name: "Buat link baru" })).toBeDisabled();
    failing.getPublication = vi.fn(async () => stored());
    fireEvent.click(screen.getByRole("button", { name: "Coba lagi" }));
    await waitFor(() => expect(update()).toBeEnabled());
  });

  it("shows an expired link as expired", async () => {
    render(<PublishDialog tree={publishedTree} repository={mockRepository(stored(new Date(Date.now() - 1000).toISOString()))} onTreeChange={() => undefined} onClose={() => undefined} />);
    expect(await screen.findByRole("status")).toHaveTextContent("Kedaluwarsa");
    expect(screen.queryByText(/^Berlaku sampai/)).not.toBeInTheDocument();
  });
});

describe("PublishCard password mode", () => {
  afterEach(cleanup);
  const PASSWORD = "Sandi#Kuat1";
  const richTree: OnlineTree = { ...privateTree, name: "Keluarga Rahasia", people: [
    { id: "budi", name: "Budi Rahasia", gender: "male", birthDate: "1950-01-02", deathDate: "", birthOrder: null, residence: "Solo", notes: "Catatan pribadi", photoUrl: "", photoVersion: null, sortOrder: 0, updatedAt: "2026-01-01T00:00:00.000Z" },
  ] };
  const chooseMode = () => fireEvent.click(screen.getByRole("radio", { name: "Pakai password" }));
  const publishButton = () => screen.getByRole("button", { name: "Bikin link berpassword" });
  const fill = (password: string, confirm: string) => {
    fireEvent.change(screen.getByLabelText("Password link"), { target: { value: password } });
    if (confirm) fireEvent.change(screen.getByLabelText("Ulangi password"), { target: { value: confirm } });
  };

  it("offers the two modes and explains the password mode", () => {
    render(<PublishDialog tree={richTree} repository={mockRepository()} onTreeChange={() => undefined} onClose={() => undefined} />);
    expect(screen.getByRole("radio", { name: "Link biasa" })).toBeChecked();
    expect(screen.queryByLabelText("Password link")).not.toBeInTheDocument();
    chooseMode();
    expect(screen.getByText(/Kirim link dan password lewat jalur terpisah/)).toBeInTheDocument();
    expect(screen.getByText(/Password yang lupa nggak bisa dipulihkan/)).toBeInTheDocument();
    expect(screen.getByText("Nama silsilah tetap kelihatan sebelum password diisi.")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Foto profil" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Masa berlaku link" })).toBeInTheDocument();
  });

  it("stays disabled until the rules are met and the confirmation matches", () => {
    render(<PublishDialog tree={richTree} repository={mockRepository()} onTreeChange={() => undefined} onClose={() => undefined} />);
    chooseMode();
    expect(publishButton()).toBeDisabled();
    fill("pendek", "pendek");
    expect(publishButton()).toBeDisabled();
    fill(PASSWORD, "Sandi#Kuat2");
    expect(publishButton()).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent("Password belum sama.");
    fill(PASSWORD, PASSWORD);
    expect(publishButton()).toBeEnabled();
  });

  it("publishes an envelope with no plaintext, never the password, and clears the fields", async () => {
    const repository = mockRepository();
    render(<PublishDialog tree={richTree} repository={repository} onTreeChange={() => undefined} onClose={() => undefined} />);
    chooseMode();
    fireEvent.change(screen.getByRole("combobox", { name: "Masa berlaku link" }), { target: { value: "7" } });
    fill(PASSWORD, PASSWORD);
    fireEvent.click(publishButton());
    await waitFor(() => expect(repository.publish).toHaveBeenCalledOnce());
    const settings = vi.mocked(repository.publish).mock.calls[0][2]!;
    expect(settings).toMatchObject({ options: { dates: true, marriageDates: true, photos: true }, expiresInDays: 7, encrypted: { format: "heritg-encrypted", version: 1, kdf: { iterations: 600000 } } });
    const sent = JSON.stringify(settings);
    for (const secret of ["Budi", "Rahasia", "Catatan", "Solo", "1950", PASSWORD]) expect(sent).not.toContain(secret);
    // The envelope opens with the password and holds the content.
    const { decryptText } = await import("../domain/secureFile");
    expect(JSON.parse(await decryptText(settings.encrypted!, PASSWORD)).people[0]).toMatchObject({ name: "Budi Rahasia", birthDate: "1950-01-02" });
    await waitFor(() => expect((screen.getByLabelText("Password link") as HTMLInputElement).value).toBe(""));
  });

  it("applies the privacy options inside the encrypted payload", async () => {
    const repository = mockRepository();
    render(<PublishDialog tree={richTree} repository={repository} onTreeChange={() => undefined} onClose={() => undefined} />);
    chooseMode();
    fireEvent.click(screen.getByRole("checkbox", { name: "Tanggal & urutan lahir" }));
    fill(PASSWORD, PASSWORD);
    fireEvent.click(publishButton());
    await waitFor(() => expect(repository.publish).toHaveBeenCalledOnce());
    const settings = vi.mocked(repository.publish).mock.calls[0][2]!;
    expect(settings.options).toEqual({ dates: false, marriageDates: true, photos: true });
    const { decryptText } = await import("../domain/secureFile");
    expect(JSON.parse(await decryptText(settings.encrypted!, PASSWORD)).people[0]).toMatchObject({ birthDate: "" });
  });

  const protectedInfo: PublicationInfo = { options: { dates: true, marriageDates: true, photos: true }, expiresAt: null, mode: "password" };

  it("a protected link needs the password again to update, but regenerates without it and without a mode", async () => {
    const repository = mockRepository(protectedInfo);
    render(<PublishDialog tree={{ ...publishedTree, people: richTree.people }} repository={repository} onTreeChange={() => undefined} onClose={() => undefined} />);
    expect(await screen.findByRole("radio", { name: "Pakai password" })).toBeChecked();
    expect(screen.getByText("Link ini dikunci dengan password.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Perbarui versi publik" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Buat link baru" }));
    await waitFor(() => expect(repository.publish).toHaveBeenCalledOnce());
    const settings = vi.mocked(repository.publish).mock.calls[0][2]!;
    expect(settings).not.toHaveProperty("mode");
    expect(settings).not.toHaveProperty("encrypted");
    expect(settings).not.toHaveProperty("options");
  });

  it("a protected link disables regenerate while options are changed without the password", async () => {
    const repository = mockRepository(protectedInfo);
    render(<PublishDialog tree={publishedTree} repository={repository} onTreeChange={() => undefined} onClose={() => undefined} />);
    await screen.findByText("Link ini dikunci dengan password.");
    expect(screen.getByText(/butuh password lagi/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: "Foto profil" }));
    expect(screen.getByRole("button", { name: "Buat link baru" })).toBeDisabled();
    expect(repository.publish).not.toHaveBeenCalled();
  });

  it("switching a protected link to plain sends an explicit plain mode", async () => {
    const repository = mockRepository(protectedInfo);
    render(<PublishDialog tree={publishedTree} repository={repository} onTreeChange={() => undefined} onClose={() => undefined} />);
    await screen.findByText("Link ini dikunci dengan password.");
    fireEvent.click(screen.getByRole("radio", { name: "Link biasa" }));
    expect(screen.getByText(/jadi link biasa/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Perbarui versi publik" }));
    await waitFor(() => expect(repository.publish).toHaveBeenCalledOnce());
    expect(vi.mocked(repository.publish).mock.calls[0][2]).toMatchObject({ mode: "plain" });
    expect(vi.mocked(repository.publish).mock.calls[0][2]).not.toHaveProperty("encrypted");
  });

  it("shows a size error and publishes nothing when the tree is too large", async () => {
    const repository = mockRepository();
    const huge = { ...richTree, people: [{ ...richTree.people[0], notes: "x".repeat(3_200_000) }] };
    render(<PublishDialog tree={huge} repository={repository} onTreeChange={() => undefined} onClose={() => undefined} />);
    chooseMode();
    fill(PASSWORD, PASSWORD);
    fireEvent.click(publishButton());
    expect(await screen.findByText(/terlalu besar/)).toBeInTheDocument();
    expect(repository.publish).not.toHaveBeenCalled();
  });
});
