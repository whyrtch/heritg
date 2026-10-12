"use client";

import React, { createContext, ReactNode, useCallback, useEffect, useMemo, useState } from "react";

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";
/** The signed-in owner as the API returns it (`uid` is the server user id). */
export type AuthUser = { uid: string; email: string; displayName: string };

export type AuthContextValue = {
  user: AuthUser | null;
  status: AuthStatus;
  /** True when the server could not be reached and the last known owner is shown (local edits keep working). */
  offline: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

/** An API failure with the server's error code ("invalid-credentials", "rate-limited", …) or "offline". */
export class AuthRequestError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = "AuthRequestError";
  }
}

// Only the public identity is cached, never the session token (that stays in the httpOnly cookie).
const CACHE_KEY = "heritg-auth-user";
function readCachedUser(): AuthUser | null {
  try {
    const value = JSON.parse(window.localStorage.getItem(CACHE_KEY) ?? "null") as AuthUser | null;
    return value && typeof value.uid === "string" && typeof value.email === "string" ? value : null;
  } catch {
    return null;
  }
}
function cacheUser(user: AuthUser | null) {
  try {
    if (user) window.localStorage.setItem(CACHE_KEY, JSON.stringify(user));
    else window.localStorage.removeItem(CACHE_KEY);
  } catch { /* storage may be unavailable */ }
}

async function callApi(path: string, init: RequestInit = {}): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(path, { ...init, credentials: "same-origin", headers: { ...(init.body ? { "Content-Type": "application/json" } : {}), ...init.headers } });
  } catch {
    throw new AuthRequestError("offline", "Unable to connect.");
  }
  const body = await response.json().catch(() => null) as { error?: { code?: string; message?: string } } | null;
  if (!response.ok) throw new AuthRequestError(body?.error?.code ?? "server-error", body?.error?.message ?? "Request failed.");
  return body;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [offline, setOffline] = useState(false);

  const apply = useCallback((next: AuthUser | null) => {
    setUser(next);
    setStatus(next ? "authenticated" : "unauthenticated");
    setOffline(false);
    cacheUser(next);
  }, []);

  useEffect(() => {
    let active = true;
    const check = () => callApi("/api/auth/session")
      .then(body => { if (active) apply((body as { user: AuthUser | null }).user); })
      .catch((error: unknown) => {
        if (!active) return;
        // Offline: keep the last owner so the local-first workspace still opens; sync resumes later.
        const cached = error instanceof AuthRequestError && error.code === "offline" ? readCachedUser() : null;
        setUser(cached);
        setStatus(cached ? "authenticated" : "unauthenticated");
        setOffline(Boolean(cached));
      });
    void check();
    // When the connection comes back, confirm the session with the server again.
    window.addEventListener("online", check);
    return () => { active = false; window.removeEventListener("online", check); };
  }, [apply]);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    status,
    offline,
    async signIn(email, password) {
      const body = await callApi("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }) as { user: AuthUser };
      apply(body.user);
    },
    async signOut() {
      // Signing out must reach the server (it deletes the session); offline it fails loudly instead of
      // only hiding the account on this screen.
      await callApi("/api/auth/logout", { method: "POST", body: "{}" });
      apply(null);
    },
    async changePassword(currentPassword, newPassword) {
      await callApi("/api/auth/password", { method: "POST", body: JSON.stringify({ currentPassword, newPassword }) });
    },
  }), [apply, offline, status, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
