import React from "react";
import { useT, type MessageKey } from "@/i18n";
import type { SyncStatus as Status } from "../sync/types";

const labels: Record<Status, MessageKey> = {
  loading: "sync.loading",
  saving: "sync.saving",
  saved: "sync.saved",
  offline: "sync.offline",
  conflict: "sync.conflict",
  "public-stale": "sync.publicStale",
};

export function SyncStatus({ status, error, onRetry }: { status: Status; error?: string | null; onRetry?: () => void }) {
  const t = useT();
  const canRetry = status === "offline" || status === "public-stale" || !!error;
  return (
    <div className={`syncStatus syncStatus--${status}`} role="status" aria-live="polite">
      <span>{t(labels[status])}</span>
      {error && <span>: {error}</span>}
      {canRetry && onRetry && <button type="button" onClick={onRetry}>{t("sync.retry")}</button>}
    </div>
  );
}
