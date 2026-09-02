"use client";

import {
  browserLocalPersistence,
  onAuthStateChanged,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  User
} from "firebase/auth";
import React, { createContext, ReactNode, useEffect, useMemo, useState } from "react";
import { getFirebaseAuth, isFirebaseConfigured } from "@/lib/firebase/config";

export type AuthStatus = "loading" | "authenticated" | "unauthenticated" | "configuration-error";

export type AuthContextValue = {
  user: User | null;
  status: AuthStatus;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");

  useEffect(() => {
    if (!isFirebaseConfigured()) {
      setStatus("configuration-error");
      return;
    }

    const auth = getFirebaseAuth();
    let active = true;
    void setPersistence(auth, browserLocalPersistence).catch(() => undefined);
    const unsubscribe = onAuthStateChanged(auth, nextUser => {
      if (!active) return;
      setUser(nextUser);
      setStatus(nextUser ? "authenticated" : "unauthenticated");
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    status,
    async signIn(email, password) {
      await signInWithEmailAndPassword(getFirebaseAuth(), email, password);
    },
    async signOut() {
      await firebaseSignOut(getFirebaseAuth());
    },
    async resetPassword(email) {
      await sendPasswordResetEmail(getFirebaseAuth(), email);
    }
  }), [status, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
