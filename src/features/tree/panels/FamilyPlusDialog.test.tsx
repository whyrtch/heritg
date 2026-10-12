import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FamilyPlusDialog } from "./FamilyPlusDialog";

let auth: { user: { email: string } | null };
vi.mock("@/features/auth/useAuth", () => ({ useAuth: () => auth }));

describe("FamilyPlusDialog", () => {
  afterEach(cleanup);

  it("shows the benefits and the account email when signed in", () => {
    auth = { user: { email: "owner@example.test" } };
    render(<FamilyPlusDialog onClose={vi.fn()} />);
    expect(screen.getByRole("dialog", { name: "Heritg Family+" })).toBeInTheDocument();
    expect(screen.getByText("Yang sudah kamu dapat")).toBeInTheDocument();
    expect(screen.getByText("Aktif di akun owner@example.test")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Masuk" })).not.toBeInTheDocument();
  });

  it("links to /login when signed out", () => {
    auth = { user: null };
    render(<FamilyPlusDialog onClose={vi.fn()} />);
    expect(screen.getByText("Masuk dulu buat sinkron online")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Masuk" })).toHaveAttribute("href", "/login");
  });

  it("shows no prices and closes with Mengerti", () => {
    auth = { user: null };
    const onClose = vi.fn();
    const { container } = render(<FamilyPlusDialog onClose={onClose} />);
    expect(container.ownerDocument.body.textContent).not.toMatch(/Rp|\$|harga|bayar/i);
    fireEvent.click(screen.getByRole("button", { name: "Mengerti" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
