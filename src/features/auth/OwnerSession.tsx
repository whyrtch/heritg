"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/features/auth/useAuth";

export function OwnerSession() {
  const { user, signOut, status } = useAuth();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Auto-refresh user status when auth changes
  }, [status, user]);

  if (status !== "authenticated" || !user) {
    return null;
  }

  return (
    <button
      className="owner-session-btn"
      onClick={async () => {
        setBusy(true);
        try {
          await signOut();
        } finally {
          setBusy(false);
        }
      }}
    >
      Sign out ({user.email})
    </button>
  );
}
