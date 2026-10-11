"use client";

import { LogIn, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import React, { useState } from "react";
import { useAuth } from "./useAuth";
import styles from "./auth.module.css";

export function OwnerSession() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  if (!user) {
    return <button className={styles.session} type="button" onClick={() => router.push("/login")}>
      <LogIn size={17} aria-hidden="true" />
      <span>Sign in</span>
    </button>;
  }

  return <button className={styles.session} type="button" disabled={busy} onClick={async () => {
    setBusy(true);
    try { await signOut(); } finally { setBusy(false); }
  }} title={user.email ?? "Owner account"}>
    <LogOut size={17} aria-hidden="true" />
    <span>{busy ? "Signing out…" : "Sign out"}</span>
  </button>;
}
