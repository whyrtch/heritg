import React from "react";
import type { SyncStatus as Status } from "../sync/types";

const labels: Record<Status, string> = {
  loading: "Loading",
  saving: "Saving…",
  saved: "Saved",
  offline: "Offline — changes saved on this device",
  conflict: "Conflict needs attention",
  "public-stale": "Public update pending",
};

export function SyncStatus({ status, error, onRetry }: { status: Status; error?: string | null; onRetry?: () => void }) {
  const canRetry = status === "offline" || status === "public-stale" || !!error;
  return (
    <div className={`syncStatus syncStatus--${status}`} role="status" aria-live="polite">
      <span>{labels[status]}</span>
      {error && <span>: {error}</span>}
      {canRetry && onRetry && <button type="button" onClick={onRetry}>Retry</button>}
    </div>
  );
}
