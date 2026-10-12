"use client";

import React, { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { useT } from "@/i18n";
import styles from "./dialogs.module.css";

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

/**
 * The heritg.us dialog shell: 430 / 620 / 780 px wide, radius 22, header and footer bars, scrolling body.
 * Focus moves into the dialog, Tab is trapped inside it, Escape and the backdrop ask to close, and focus
 * returns to whatever opened it.
 */
export function Dialog({ title, width = 620, onClose, footer, children, initialFocus }: { title: string; width?: 430 | 620 | 780; onClose: () => void; footer?: ReactNode; children: ReactNode; initialFocus?: string }) {
  const t = useT();
  const ref = useRef<HTMLElement>(null);
  const titleId = useId();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const node = ref.current;
    const first = (initialFocus && node?.querySelector<HTMLElement>(initialFocus)) || node?.querySelector<HTMLElement>(`.${styles.body} ${FOCUSABLE}`) || node;
    first?.focus();
    return () => { previous?.focus?.(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape") {
      // A nested dialog (date picker, confirm) handles its own Escape first.
      if ((event.target as HTMLElement).closest("[data-nested-popup]")) return;
      event.stopPropagation();
      onCloseRef.current();
      return;
    }
    if (event.key !== "Tab" || !ref.current) return;
    const items = [...ref.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(item => item.offsetParent !== null || item === document.activeElement);
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };

  return <div className={styles.backdrop} onMouseDown={event => { if (event.target === event.currentTarget) onCloseRef.current(); }}>
    <section ref={ref} className={`${styles.dialog} ${styles[`w${width}`]}`} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} onKeyDown={onKeyDown}>
      <header className={styles.head}>
        <h2 id={titleId}>{title}</h2>
        <button type="button" className={styles.close} onClick={() => onCloseRef.current()}><X size={20} aria-hidden="true" /><span className={styles.srOnly}>{t("dialog.close")}</span></button>
      </header>
      <div className={styles.body}>{children}</div>
      {footer && <footer className={styles.foot}>{footer}</footer>}
    </section>
  </div>;
}

/** "Batal simpan?" — asked whenever a dialog with unsaved input is closed. */
export function DiscardConfirm({ onKeep, onDiscard }: { onKeep: () => void; onDiscard: () => void }) {
  const t = useT();
  return <Dialog title={t("discard.title")} width={430} onClose={onKeep} footer={<>
    <button type="button" className={styles.button} onClick={onKeep}>{t("common.cancel")}</button>
    <button type="button" className={`${styles.button} ${styles.dangerButton}`} onClick={onDiscard}>{t("discard.discard")}</button>
  </>}>
    <p className={styles.confirmText}>{t("discard.body")}</p>
  </Dialog>;
}

/** Wraps a close handler so a dirty form asks "Batal simpan?" first. */
export function useDiscardGuard(dirty: boolean, onClose: () => void) {
  const [asking, setAsking] = useState(false);
  const requestClose = useCallback(() => { if (dirty) setAsking(true); else onClose(); }, [dirty, onClose]);
  const confirm = asking ? <DiscardConfirm onKeep={() => setAsking(false)} onDiscard={() => { setAsking(false); onClose(); }} /> : null;
  return { requestClose, confirm };
}

export { styles as dialogStyles };
