import React from "react";
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
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="tree-conflict-title" aria-describedby="tree-conflict-description">
      <h2 id="tree-conflict-title">This family tree changed elsewhere</h2>
      <p id="tree-conflict-description">
        Your version is revision {conflict.local.revision}; the online version is revision {conflict.remote.revision}.
      </p>
      <p>Keeping the online version downloads your local work as a .heritg backup first.</p>
      {error && <p role="alert">{error}</p>}
      <button type="button" disabled={busy} onClick={onKeepRemote}>Download backup and keep online version</button>
      <button type="button" disabled={busy} onClick={onReplaceRemote}>
        {replaceConfirmationRequired ? "Confirm replacing online version" : "Replace online with my version"}
      </button>
      {replaceConfirmationRequired && onCancelReplace && <button type="button" disabled={busy} onClick={onCancelReplace}>Cancel replacement</button>}
    </div>
  );
}
