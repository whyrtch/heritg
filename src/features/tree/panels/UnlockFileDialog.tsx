"use client";

import React, { useState, type FormEvent } from "react";
import { useT } from "@/i18n";
import { Dialog, dialogStyles } from "../dialogs/Dialog";
import { PasswordField } from "./PasswordField";
import styles from "./panels.module.css";

export type UnlockFailure = "wrong-password" | "damaged";

/**
 * "Buka file terkunci": asks for the password of an encrypted backup. `onUnlock` resolves to null on success or to
 * the reason it failed; nothing changes until it succeeds. The password lives only in this component's state.
 */
export function UnlockFileDialog({ onClose, onUnlock }: { onClose: () => void; onUnlock: (password: string) => Promise<UnlockFailure | null> }) {
  const t = useT();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<UnlockFailure | null>(null);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!password || busy) return;
    setBusy(true); setFailure(null);
    try { setFailure(await onUnlock(password)); } catch { setFailure("damaged"); } finally { setBusy(false); }
  };
  return <Dialog title={t("unlock.title")} width={430} onClose={onClose} initialFocus="input" footer={<>
    <button type="button" className={dialogStyles.button} onClick={onClose}>{t("common.cancel")}</button>
    <button type="submit" form="unlock-file-form" className={`${dialogStyles.button} ${dialogStyles.primary}`} disabled={!password || busy}>{busy ? t("unlock.busy") : t("unlock.open")}</button>
  </>}>
    <form id="unlock-file-form" onSubmit={submit}>
      <p className={styles.detailText}>{t("unlock.body")}</p>
      <PasswordField label={t("unlock.field")} value={password} onChange={value => { setPassword(value); setFailure(null); }} autoComplete="current-password" invalid={failure === "wrong-password"} />
      {failure && <p className={styles.deleteError} role="alert">{failure === "wrong-password" ? t("unlock.wrong") : t("unlock.damaged")}</p>}
    </form>
  </Dialog>;
}
