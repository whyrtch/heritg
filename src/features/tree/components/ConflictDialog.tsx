import React from "react";
import { useT } from "@/i18n";
import type { TreeConflict } from "../sync/types";

export function ConflictDialog({
  conflict,
  replaceConfirmationRequired,
  busy = false,
  error,
  onKeepRemote,
  onReplaceRemote,
  onCancelReplace,
}: {
  conflict: TreeConflict;
  replaceConfirmationRequired: boolean;
  busy?: boolean;
  error?: string | null;
  onKeepRemote: () => void;
  onReplaceRemote: () => void;
  onCancelReplace?: () => void;
}) {
  const t = useT();
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="tree-conflict-title" aria-describedby="tree-conflict-description">
      <h2 id="tree-conflict-title">{t("conflict.title")}</h2>
      <p id="tree-conflict-description">{t("conflict.body", { local: conflict.local.revision, remote: conflict.remote.revision })}</p>
      <p>{t("conflict.backupNote")}</p>
      {error && <p role="alert">{error}</p>}
      <button type="button" disabled={busy} onClick={onKeepRemote}>{t("conflict.keepRemote")}</button>
      <button type="button" disabled={busy} onClick={onReplaceRemote}>
        {replaceConfirmationRequired ? t("conflict.confirmReplace") : t("conflict.replace")}
      </button>
      {replaceConfirmationRequired && onCancelReplace && <button type="button" disabled={busy} onClick={onCancelReplace}>{t("conflict.cancelReplace")}</button>}
    </div>
  );
}
