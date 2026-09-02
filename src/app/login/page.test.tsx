import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LoginPage from "./page";

const replace = vi.fn();
const signIn = vi.fn();
const resetPassword = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));
vi.mock("@/features/auth/useAuth", () => ({
  useAuth: () => ({ status: "unauthenticated", user: null, signIn, resetPassword, signOut: vi.fn() })
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

  it("always displays a neutral password reset confirmation", async () => {
    resetPassword.mockRejectedValueOnce({ code: "auth/user-not-found" });
    render(<LoginPage />);
    fireEvent.click(screen.getByRole("button", { name: "Forgot your password?" }));
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "unknown@example.test" } });
    fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));

    expect(await screen.findByText(/if an account exists/i)).toBeVisible();
  });
});
