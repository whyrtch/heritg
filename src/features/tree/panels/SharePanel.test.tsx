import React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { OnlineTree } from "../domain/onlineTypes";
import type { PublicationRepository } from "../publishing/PublicationRepository";
import { SharePanel } from "./SharePanel";

const tree: OnlineTree = {
  id: "tree-one", ownerId: "owner", name: "Family", visibility: "private", publicId: null,
  revision: 1, schemaVersion: 1, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
  publishedRevision: null, people: [], relationships: [],
};
const repository: PublicationRepository = { publish: vi.fn(), disable: vi.fn(), loadPublic: vi.fn(async () => null) };

function setup(overrides: Partial<React.ComponentProps<typeof SharePanel>> = {}) {
  const props = { treeName: "Keluarga Saya", peopleCount: 3, example: false, signedIn: false, publishing: null, onDownload: vi.fn(), onClose: vi.fn(), ...overrides };
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
    expect(screen.getByText("Segera hadir")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Download .heritg" })).not.toBeInTheDocument();
    fireEvent.click(method("Simpan Gambar"));
    expect(screen.getByText("Gambar pohon dalam format PNG atau SVG.")).toBeInTheDocument();
  });

  it("downloads the backup", () => {
    const props = setup();
    fireEvent.click(screen.getByRole("button", { name: "Download .heritg" }));
    expect(props.onDownload).toHaveBeenCalledTimes(1);
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
    expect(screen.queryByRole("button", { name: "Publish with link" })).not.toBeInTheDocument();
    cleanup();
    setup({ example: true, signedIn: true });
    fireEvent.click(method("Bikin Link Web"));
    expect(screen.getByText(/nggak bisa dibagikan lewat link web/)).toBeInTheDocument();
  });

  it("shows the publish UI inline, selected by default, only for a synced tree", () => {
    setup({ signedIn: true, publishing: { tree, repository, onTreeChange: vi.fn() } });
    expect(method("Bikin Link Web")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Publish with link" })).toBeInTheDocument();
    expect(screen.getByText(/Anyone who has this link/i)).toBeInTheDocument();
  });
});
