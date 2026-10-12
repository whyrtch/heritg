import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { encryptText } from "@/features/tree/domain/secureFile";
import type { EncryptedPublicTree, PublicTreeSnapshot } from "@/features/tree/publishing/PublicationRepository";
import { PublicTree } from "./PublicTree";

const snapshot: PublicTreeSnapshot = {
  publicId: "public_identifier_123456",
  name: "Keluarga Uji",
  schemaVersion: 1,
  publishedRevision: 4,
  publishedAt: "2026-01-01T00:00:00.000Z",
  tree: {
    id: "public_identifier_123456",
    name: "Keluarga Uji",
    updatedAt: "2026-01-01T00:00:00.000Z",
    people: [{ id: "one", name: "Budi Uji", gender: "male", birthDate: "1980-01-01", deathDate: "", birthOrder: null, residence: "", notes: "A note", photoUrl: "" }],
    relationships: [],
  },
};

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("PublicTree", () => {
  it("renders a public snapshot without editing controls", async () => {
    render(<PublicTree publicId={snapshot.publicId} loader={vi.fn(async () => snapshot)} />);
    expect(await screen.findByText("Budi Uji")).toBeInTheDocument();
    // The public page is read-only: no button at all, except the unlock form of a password-protected link (tested below).
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByText(/edit/i)).not.toBeInTheDocument();
  });

  it("sizes the stage to the whole tree so no generation is cropped", async () => {
    const people = ["a", "b", "c"].map(id => ({ ...snapshot.tree.people[0], id, name: `${id.toUpperCase()} Uji` }));
    const tree = { ...snapshot.tree, people, relationships: [
      { id: "ab", type: "partner" as const, from: "a", to: "b", kind: null, status: "married" as const, marriedOn: "" },
      { id: "ac", type: "parent-child" as const, from: "a", to: "c", kind: "biological" as const, status: null, marriedOn: "" },
    ] };
    const { container } = render(<PublicTree publicId={snapshot.publicId} loader={vi.fn(async () => ({ ...snapshot, tree }))} />);
    await screen.findByText("C Uji");
    const stage = container.querySelector<HTMLElement>("[data-stage]")!;
    // Two partners on one 260 px row plus a child below: 260 + 2 × 120 wide, two rows plus labels high.
    expect(stage.style.width).toBe("500px");
    expect(stage.style.height).toBe("426px");
    const svg = stage.querySelector("svg")!;
    expect(svg.getAttribute("viewBox")).toBe("-250 -48 500 426");
    expect(svg.querySelectorAll("circle").length).toBeGreaterThanOrEqual(6);
  });

  it("uses one generic unavailable state for inaccessible links", async () => {
    render(<PublicTree publicId="missing_public_identifier" loader={vi.fn(async () => null)} />);
    await waitFor(() => expect(screen.getByText("Silsilah ini nggak tersedia")).toBeInTheDocument());
  });
});

describe("PublicTree with a password-protected link", () => {
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
  const PASSWORD = "Sandi#Kuat1";
  const body = { people: [{ id: "one", name: "Budi Uji", gender: "male", birthDate: "1980-01-01", deathDate: "", birthOrder: null, residence: "", notes: "", photoUrl: "", photoVersion: null, sortOrder: 0 }], relationships: [] };
  const locked = async (): Promise<EncryptedPublicTree> => ({ encrypted: true, publicId: "public_identifier_123456", name: "Keluarga Terkunci", envelope: await encryptText(JSON.stringify(body), PASSWORD, { iterations: 100_000 }) });
  const open = async (password: string) => {
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: password } });
    fireEvent.click(screen.getByRole("button", { name: "Buka" }));
  };

  it("shows only the name and a password form, with exactly one button", async () => {
    const link = await locked();
    render(<PublicTree publicId={link.publicId} loader={vi.fn(async () => link)} />);
    expect(await screen.findByRole("heading", { name: "Keluarga Terkunci" })).toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Buka" })).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "password");
    expect(screen.queryByText("Budi Uji")).not.toBeInTheDocument();
    expect(screen.queryByText(/edit/i)).not.toBeInTheDocument();
  });

  it("a wrong password shows the error, can be retried, and sends nothing anywhere", async () => {
    const link = await locked();
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    render(<PublicTree publicId={link.publicId} loader={vi.fn(async () => link)} />);
    await screen.findByRole("heading", { name: "Keluarga Terkunci" });
    await open("Salah#Sandi9");
    expect(await screen.findByRole("alert")).toHaveTextContent("Password salah");
    expect(screen.queryByText("Budi Uji")).not.toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(1);
    await open(PASSWORD);
    expect(await screen.findByText("Budi Uji")).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("renders the tree after unlocking, with no buttons and no edit wording left", async () => {
    const link = await locked();
    const { container } = render(<PublicTree publicId={link.publicId} loader={vi.fn(async () => link)} />);
    await screen.findByRole("heading", { name: "Keluarga Terkunci" });
    await open(PASSWORD);
    expect(await screen.findByText("Budi Uji")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Keluarga Terkunci" })).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Password")).not.toBeInTheDocument();
    expect(screen.queryByText(/edit/i)).not.toBeInTheDocument();
    expect(container.textContent).not.toContain(PASSWORD);
  });

  it("says the data is damaged when the content decrypts but is not a family tree", async () => {
    const link = { ...(await locked()), envelope: await encryptText("{\"people\":\"no\"}", PASSWORD, { iterations: 100_000 }) };
    render(<PublicTree publicId={link.publicId} loader={vi.fn(async () => link)} />);
    await screen.findByRole("heading", { name: "Keluarga Terkunci" });
    await open(PASSWORD);
    expect(await screen.findByRole("alert")).toHaveTextContent(/rusak/);
  });
});

describe("PublicTree languages", () => {
  afterEach(async () => { cleanup(); const { setLanguage } = await import("@/i18n"); setLanguage("id"); });
  it("keeps the read-only page free of edit wording in every language", async () => {
    const { setLanguage } = await import("@/i18n");
    for (const language of ["id", "en", "ms"] as const) {
      setLanguage(language);
      const { container, unmount } = render(<PublicTree publicId={snapshot.publicId} loader={vi.fn(async () => snapshot)} />);
      await screen.findByText("Budi Uji");
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
      expect(container.textContent).not.toMatch(/edit|ubah|sunting/i);
      unmount();
    }
  });
  it("shows the English chrome when the language is English", async () => {
    const { setLanguage } = await import("@/i18n");
    setLanguage("en");
    render(<PublicTree publicId={snapshot.publicId} loader={vi.fn(async () => snapshot)} />);
    expect(await screen.findByText("Shared by link")).toBeInTheDocument();
    expect(screen.getByText("View only. Published version 4")).toBeInTheDocument();
  });
});
