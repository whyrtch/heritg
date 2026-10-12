"use client";

import { useRouter } from "next/navigation";
import React, { ReactNode, useEffect } from "react";
import { useAuth } from "./useAuth";
import styles from "./auth.module.css";

export function RequireOwner({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [router, status]);

  if (status !== "authenticated") {
    return <main className={styles.state} aria-live="polite"><span className={styles.spinner} aria-hidden="true" />Opening your private archive…</main>;
  }

  return children;
}
