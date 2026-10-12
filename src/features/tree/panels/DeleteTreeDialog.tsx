"use client";

import React, { useState } from "react";
import { Trash2 } from "lucide-react";
import { useT } from "@/i18n";
import { Dialog, dialogStyles } from "../dialogs/Dialog";
import styles from "./panels.module.css";

export type DeleteFailure = "offline" | "signed-out" | "failed";

/** "Hapus <name>?": the owner confirms; nothing is removed until `onConfirm` resolves to null (success). */
export function DeleteTreeDialog({ name, people, relationships, synced, onClose, onConfirm }: { name: string; people: number; relationships: number; synced: boolean; onClose: () => void; onConfirm: () => Promise<DeleteFailure | null> }) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<DeleteFailure | null>(null);
  const confirm = async () => {
    setBusy(true); setError(null);
    const failure = await onConfirm();
    // On success the parent unmounts this dialog, so only a failure touches state again.
    if (failure) { setError(failure); setBusy(false); }
  };
  const message = error === "offline" ? t("delete.offline") : error === "signed-out" ? t("delete.signedOut") : t("delete.failed");
  return <Dialog title={t("delete.title", { name })} width={430} onClose={() => { if (!busy) onClose(); }} footer={<>
    <button type="button" className={dialogStyles.button} disabled={busy} onClick={onClose}>{t("common.cancel")}</button>
    <button type="button" className={`${dialogStyles.button} ${dialogStyles.dangerButton}`} disabled={busy} aria-busy={busy} onClick={() => void confirm()}><Trash2 size={16} aria-hidden="true" />{busy ? t("delete.busy") : t("delete.confirm")}</button>
  </>}>
    <p>{t(synced ? "delete.bodySynced" : "delete.bodyLocal", { people, relationships })}</p>
    {error && <p className={styles.deleteError} role="alert">{message}</p>}
  </Dialog>;
}
