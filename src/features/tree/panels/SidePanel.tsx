"use client";
import React, { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { useT } from "@/i18n";
import styles from "./panels.module.css";

/** Shared right-hand panel: non-modal dialog, closes with the close button or Escape. */
export function SidePanel({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const t = useT();
  const root = useRef<HTMLElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  // Focus moves into the panel (unless a field inside already took it) and returns to the opener on close.
  // Captured during the first render, before an autofocused field inside the panel can take focus.
  const opener = useRef<HTMLElement | null>(null);
  if (opener.current === null && typeof document !== "undefined") opener.current = document.activeElement as HTMLElement | null;
  useEffect(() => {
    const previous = opener.current;
    if (!root.current?.contains(document.activeElement)) closeButton.current?.focus();
    return () => { if (previous && previous !== document.body && previous.isConnected) previous.focus(); };
  }, []);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return <section ref={root} className={styles.sidePanel} role="dialog" aria-modal="false" aria-label={title}>
    <header className={styles.head}>
      <h2>{title}</h2>
      <button ref={closeButton} type="button" className={styles.close} aria-label={t("dialog.close")} title={t("dialog.close")} onClick={onClose}><X size={20} aria-hidden="true" /></button>
    </header>
    <div className={styles.body}>{children}</div>
  </section>;
}
