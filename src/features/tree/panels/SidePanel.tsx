"use client";
import React, { useEffect } from "react";
import { X } from "lucide-react";
import { useT } from "@/i18n";
import styles from "./panels.module.css";

/** Shared right-hand panel: non-modal dialog, closes with the close button or Escape. */
export function SidePanel({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const t = useT();
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return <section className={styles.sidePanel} role="dialog" aria-modal="false" aria-label={title}>
    <header className={styles.head}>
      <h2>{title}</h2>
      <button type="button" className={styles.close} aria-label={t("dialog.close")} title={t("dialog.close")} onClick={onClose}><X size={20} aria-hidden="true" /></button>
    </header>
    <div className={styles.body}>{children}</div>
  </section>;
}
