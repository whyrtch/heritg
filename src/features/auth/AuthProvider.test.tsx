import React from "react";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, AuthRequestError, type AuthContextValue } from "./AuthProvider";
import { useAuth } from "./useAuth";

const owner = { uid: "u-1", email: "owner@heritg.test", displayName: "Pemilik" };
let auth: AuthContextValue;
function Probe() { auth = useAuth(); return <p>{auth.status}:{auth.user?.email ?? "-"}:{auth.offline ? "offline" : "online"}</p>; }
const reply = (status: number, body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));

describe("AuthProvider", () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  it("restores the session from the server", async () => {
    const fetch = vi.fn(() => reply(200, { user: owner }));
    vi.stubGlobal("fetch", fetch);
    render(<AuthProvider><Probe /></AuthProvider>);
    expect(await screen.findByText("authenticated:owner@heritg.test:online")).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith("/api/auth/session", expect.objectContaining({ credentials: "same-origin" }));
    expect(JSON.parse(window.localStorage.getItem("heritg-auth-user")!)).toEqual(owner);
  });

  it("is signed out when the server has no session, and forgets the cached owner", async () => {
    window.localStorage.setItem("heritg-auth-user", JSON.stringify(owner));
    vi.stubGlobal("fetch", vi.fn(() => reply(200, { user: null })));
    render(<AuthProvider><Probe /></AuthProvider>);
    expect(await screen.findByText("unauthenticated:-:online")).toBeInTheDocument();
    expect(window.localStorage.getItem("heritg-auth-user")).toBeNull();
  });

  it("keeps the last owner while offline so local trees still open", async () => {
    window.localStorage.setItem("heritg-auth-user", JSON.stringify(owner));
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new TypeError("Failed to fetch"))));
    render(<AuthProvider><Probe /></AuthProvider>);
    expect(await screen.findByText("authenticated:owner@heritg.test:offline")).toBeInTheDocument();
  });

  it("does not invent a session offline without a cached owner", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new TypeError("Failed to fetch"))));
    render(<AuthProvider><Probe /></AuthProvider>);
    expect(await screen.findByText("unauthenticated:-:online")).toBeInTheDocument();
  });

  it("signs in and out through the API and reports server error codes", async () => {
    const fetch = vi.fn((path: string, init?: RequestInit) => {
      if (path === "/api/auth/session") return reply(200, { user: null });
      if (path === "/api/auth/login") return JSON.parse(String(init?.body)).password === "right password" ? reply(200, { user: owner }) : reply(401, { error: { code: "invalid-credentials", message: "x" } });
      return reply(200, { ok: true });
    });
    vi.stubGlobal("fetch", fetch);
    render(<AuthProvider><Probe /></AuthProvider>);
    await screen.findByText("unauthenticated:-:online");
    await expect(auth.signIn(owner.email, "wrong")).rejects.toMatchObject({ code: "invalid-credentials" } satisfies Partial<AuthRequestError>);
    await act(() => auth.signIn(owner.email, "right password"));
    expect(screen.getByText("authenticated:owner@heritg.test:online")).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith("/api/auth/login", expect.objectContaining({ method: "POST", headers: { "Content-Type": "application/json" } }));
    await act(() => auth.signOut());
    await waitFor(() => expect(screen.getByText("unauthenticated:-:online")).toBeInTheDocument());
    expect(fetch).toHaveBeenCalledWith("/api/auth/logout", expect.objectContaining({ method: "POST" }));
    expect(window.localStorage.getItem("heritg-auth-user")).toBeNull();
  });

  it("refuses to pretend a sign-out worked while offline, and re-checks when back online", async () => {
    let online = true;
    vi.stubGlobal("fetch", vi.fn(() => online ? reply(200, { user: owner }) : Promise.reject(new TypeError("Failed to fetch"))));
    render(<AuthProvider><Probe /></AuthProvider>);
    await screen.findByText("authenticated:owner@heritg.test:online");
    online = false;
    await expect(auth.signOut()).rejects.toMatchObject({ code: "offline" });
    expect(screen.getByText("authenticated:owner@heritg.test:online")).toBeInTheDocument();
    online = true;
    act(() => { window.dispatchEvent(new Event("online")); });
    await screen.findByText("authenticated:owner@heritg.test:online");
  });
});
