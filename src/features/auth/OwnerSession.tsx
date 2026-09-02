"use client";

import { LogOut } from "lucide-react";
import React, { useState } from "react";
import { useAuth } from "./useAuth";
import styles from "./auth.module.css";

export function OwnerSession() {
  const { user, signOut } = useAuth();
  const [busy, setBusy] = useState(false);

  return <button className={styles.session} type="button" disabled={busy} onClick={async () => {
    setBusy(true);
    try { await signOut(); } finally { setBusy(false); }
  }} title={user?.email ?? "Owner account"}>
    <LogOut size={17} aria-hidden="true" />
    <span>{busy ? "Signing out…" : "Sign out"}</span>
  </button>;
}
