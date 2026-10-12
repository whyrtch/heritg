import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LoginPage from "./page";

const replace = vi.fn();
const signIn = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));
vi.mock("@/features/auth/useAuth", () => ({
  useAuth: () => ({ status: "unauthenticated", user: null, signIn, signOut: vi.fn() })
}));

describe("LoginPage", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(cleanup);

  it("submits owner email and password without offering registration", async () => {
    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "owner@example.test" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "secret-pass" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(signIn).toHaveBeenCalledWith("owner@example.test", "secret-pass"));
    expect(screen.queryByRole("link", { name: /register/i })).not.toBeInTheDocument();
  });

  it("shows a neutral error without revealing whether the account exists", async () => {
    signIn.mockRejectedValueOnce({ code: "invalid-credentials" });
    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "unknown@example.test" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "whatever-pass" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("The email or password is incorrect.");
    expect(replace).not.toHaveBeenCalled();
  });

  it("explains the server-side password reset instead of sending email", () => {
    render(<LoginPage />);
    fireEvent.click(screen.getByRole("button", { name: "Forgot your password?" }));
    expect(screen.getByText("owner:reset-password", { exact: false })).toBeVisible();
    expect(screen.queryByLabelText("Password")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Back to sign in" }));
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
  });
});
