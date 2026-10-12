"use client";

import React, { createContext, ReactNode, useEffect, useMemo, useState, useCallback } from "react";

export type AuthStatus = "loading" | "authenticated" | "unauthenticated" | "configuration-error";

export type User = {
  id: string;
  email: string;
  full_name: string;
  role: string;
};

export type AuthContextValue = {
  user: User | null;
  status: AuthStatus;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  register: (email: string, password: string, fullName: string) => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8081/api/v1";

async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const token = localStorage.getItem("auth_token");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...options.headers as Record<string, string>,
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  const response = await fetch(url, { ...options, headers });
  if (response.status === 401) {
    localStorage.removeItem("auth_token");
    throw new Error("Unauthorized");
  }
  return response;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");

  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    if (!token) {
      setStatus("unauthenticated");
      return;
    }
    
    fetchWithAuth(`${API_URL}/users/me`)
      .then(res => res.json())
      .then(data => {
        setUser(data);
        setStatus("authenticated");
      })
      .catch(() => {
        localStorage.removeItem("auth_token");
        setStatus("unauthenticated");
      });
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Login failed");
    }
    
    const data = await response.json();
    localStorage.setItem("auth_token", data.token);
    setUser(data.user);
    setStatus("authenticated");
  }, []);

  const register = useCallback(async (email: string, password: string, fullName: string) => {
    const response = await fetch(`${API_URL}/auth/register`, {
      method: "POST",
      body: JSON.stringify({ email, password, full_name: fullName }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Registration failed");
    }
    
    const data = await response.json();
    localStorage.setItem("auth_token", data.token);
    setUser(data.user);
    setStatus("authenticated");
  }, []);

  const signOut = useCallback(async () => {
    localStorage.removeItem("auth_token");
    setUser(null);
    setStatus("unauthenticated");
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    status,
    signIn,
    signOut,
    register,
  }), [status, user, signIn, signOut, register]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
