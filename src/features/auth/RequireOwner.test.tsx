import { cleanup, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RequireOwner } from "./RequireOwner";

const replace = vi.fn();
let status = "loading";
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));
vi.mock("./useAuth", () => ({ useAuth: () => ({ status }) }));

describe("RequireOwner", () => {
  afterEach(cleanup);
  it("shows a neutral loading state while authentication resolves", () => {
    status = "loading";
    render(<RequireOwner><p>Private</p></RequireOwner>);
    expect(screen.getByText(/buka arsip pribadimu/i)).toBeVisible();
    expect(screen.queryByText("Private")).not.toBeInTheDocument();
  });

  it("redirects unauthenticated visitors", async () => {
    status = "unauthenticated";
    render(<RequireOwner><p>Private</p></RequireOwner>);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
  });

  it("renders the workspace for an authenticated owner", () => {
    status = "authenticated";
    render(<RequireOwner><p>Private</p></RequireOwner>);
    expect(screen.getByText("Private")).toBeVisible();
  });
});
