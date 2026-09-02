"use client";

import React, { useMemo, useState } from "react";
import type { OnlineTree } from "../domain/onlineTypes";
import type { PublicationRepository } from "../publishing/PublicationRepository";
import { publishTree, regeneratePublicId, unpublishTree, updatePublishedTree } from "../publishing/publishTree";

export type PublishDialogProps = {
  tree: OnlineTree;
  repository: PublicationRepository;
  onTreeChange: (tree: OnlineTree) => void;
  onClose: () => void;
  appUrl?: string;
};

export function PublishDialog({ tree, repository, onTreeChange, onClose, appUrl }: PublishDialogProps) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [cleanupPending, setCleanupPending] = useState(false);
  const publicUrl = useMemo(() => {
    if (!tree.publicId) return "";
    const base = appUrl ?? (typeof window === "undefined" ? "" : window.location.origin);
    return `${base.replace(/\/$/, "")}/tree/${tree.publicId}`;
  }, [appUrl, tree.publicId]);

  const run = async (label: string, action: () => Promise<OnlineTree | { tree: OnlineTree; cleanupPending: boolean }>) => {
    setBusy(label);
    setError("");
    try {
      const result = await action();
      if ("tree" in result) {
        setCleanupPending(result.cleanupPending);
        onTreeChange(result.tree);
      } else {
        setCleanupPending(false);
        onTreeChange(result);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The publication could not be updated.");
    } finally {
      setBusy(null);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
    } catch {
      setError("Copy failed. Select and copy the link manually.");
    }
  };

  const isPublished = tree.visibility === "unlisted" && Boolean(tree.publicId);
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="publish-title" style={backdropStyle}>
      <section style={dialogStyle}>
        <header style={headerStyle}>
          <div><small style={eyebrowStyle}>UNLISTED SHARING</small><h2 id="publish-title" style={{ margin: "4px 0 0" }}>Share family tree</h2></div>
          <button type="button" aria-label="Close sharing dialog" onClick={onClose} style={quietButtonStyle}>×</button>
        </header>
        <div style={warningStyle}>
          Anyone who has this link can view every published name, date, note, and photo URL. The link can be forwarded.
        </div>

        {!isPublished ? (
          <button type="button" disabled={Boolean(busy)} onClick={() => run("publish", () => publishTree(repository, tree))} style={primaryButtonStyle}>
            {busy === "publish" ? "Publishing…" : "Publish with link"}
          </button>
        ) : (
          <>
            <label style={labelStyle}>Public link<input aria-label="Public link" readOnly value={publicUrl} style={inputStyle} /></label>
            <div style={buttonRowStyle}>
              <button type="button" disabled={Boolean(busy)} onClick={copy} style={primaryButtonStyle}>{copied ? "Copied" : "Copy link"}</button>
              <button type="button" disabled={Boolean(busy)} onClick={() => run("update", () => updatePublishedTree(repository, tree))} style={secondaryButtonStyle}>{busy === "update" ? "Updating…" : "Update public version"}</button>
            </div>
            <p style={metaStyle}>Published revision {tree.publishedRevision ?? "—"}{tree.publishedRevision !== tree.revision ? " · Public update pending" : ""}</p>
            <hr style={{ border: 0, borderTop: "1px solid #ded4c8", margin: "20px 0" }} />
            <div style={buttonRowStyle}>
              <button type="button" disabled={Boolean(busy)} onClick={() => run("regenerate", () => regeneratePublicId(repository, tree))} style={secondaryButtonStyle}>{busy === "regenerate" ? "Regenerating…" : "Regenerate link"}</button>
              <button type="button" disabled={Boolean(busy)} onClick={() => run("unpublish", () => unpublishTree(repository, tree))} style={dangerButtonStyle}>{busy === "unpublish" ? "Unpublishing…" : "Unpublish"}</button>
            </div>
          </>
        )}
        {cleanupPending && <p role="status" style={metaStyle}>Access is revoked. Background cleanup can be retried later.</p>}
        {error && <p role="alert" style={errorStyle}>{error}</p>}
      </section>
    </div>
  );
}

const backdropStyle = { position: "fixed", inset: 0, zIndex: 60, display: "grid", placeItems: "center", padding: 16, background: "rgba(39,32,25,.45)" } as const;
const dialogStyle = { width: 520, maxWidth: "100%", padding: 24, borderRadius: 20, background: "#fbf8f2", border: "1px solid #ded4c8", boxShadow: "0 26px 70px rgba(51,39,24,.28)" } as const;
const headerStyle = { display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 18 } as const;
const eyebrowStyle = { color: "#806a51", letterSpacing: ".12em", fontWeight: 800 } as const;
const warningStyle = { padding: 14, marginBottom: 18, borderRadius: 12, color: "#554a3f", background: "#eee7dd", fontSize: 14, lineHeight: 1.5 } as const;
const labelStyle = { display: "grid", gap: 7, color: "#71665b", fontSize: 12, fontWeight: 700 } as const;
const inputStyle = { width: "100%", padding: "11px 12px", borderRadius: 10, border: "1px solid #ded4c8", background: "#fffdfa" } as const;
const buttonRowStyle = { display: "flex", flexWrap: "wrap", gap: 10, marginTop: 12 } as const;
const baseButton = { minHeight: 42, padding: "0 15px", borderRadius: 11, fontWeight: 750, cursor: "pointer" } as const;
const primaryButtonStyle = { ...baseButton, border: "1px solid #604175", background: "#604175", color: "white" } as const;
const secondaryButtonStyle = { ...baseButton, border: "1px solid #ded4c8", background: "#fffdfa", color: "#392f28" } as const;
const dangerButtonStyle = { ...baseButton, border: "1px solid #b45a50", background: "transparent", color: "#973f36" } as const;
const quietButtonStyle = { border: 0, background: "transparent", fontSize: 28, cursor: "pointer", color: "#71665b" } as const;
const metaStyle = { color: "#71665b", fontSize: 12, margin: "10px 0 0" } as const;
const errorStyle = { color: "#973f36", fontSize: 13, margin: "14px 0 0" } as const;
