import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OwnerSession } from "./OwnerSession";

const push = vi.fn();
const signOut = vi.fn(async () => undefined);
let auth: { user: { email: string } | null; status: string };

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("./useAuth", () => ({ useAuth: () => ({ ...auth, signOut }) }));

describe("OwnerSession", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(cleanup);

  it("offers sign in, not sign out, when nobody is signed in", () => {
    auth = { user: null, status: "unauthenticated" };
    render(<OwnerSession />);
    expect(screen.queryByRole("button", { name: /keluar/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Masuk" }));
    expect(push).toHaveBeenCalledWith("/login");
  });

  it("signs the owner out when signed in", async () => {
    auth = { user: { email: "owner@example.test" }, status: "authenticated" };
    render(<OwnerSession />);
    fireEvent.click(screen.getByRole("button", { name: "Keluar" }));
    await waitFor(() => expect(signOut).toHaveBeenCalledOnce());
    expect(screen.queryByRole("button", { name: "Sign in" })).not.toBeInTheDocument();
  });
});
