"use client";

import React, { useMemo, useState } from "react";
import { X } from "lucide-react";
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
  const publicUrl = useMemo(() => {
    if (!tree.publicId) return "";
    const base = appUrl ?? (typeof window === "undefined" ? "" : window.location.origin);
    return `${base.replace(/\/$/, "")}/tree/${tree.publicId}`;
  }, [appUrl, tree.publicId]);

  const run = async (label: string, action: () => Promise<OnlineTree>) => {
    setBusy(label);
    setError("");
    try {
      onTreeChange(await action());
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
          <h2 id="publish-title" style={titleStyle}>Share family tree</h2>
          <button type="button" aria-label="Close sharing dialog" onClick={onClose} style={quietButtonStyle}><X size={20} aria-hidden="true" /></button>
        </header>
        <div style={warningStyle}>
          Anyone who has this link can view every published name, date, residence, note, photo and family relationship. The link can be forwarded.
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
            <p style={metaStyle}>{tree.publishedRevision !== tree.revision ? `The link shows version ${tree.publishedRevision ?? "—"}. Your newest edits aren’t public yet.` : `The link shows version ${tree.publishedRevision}.`}</p>
            <hr style={{ border: 0, borderTop: "1px solid var(--line)", margin: "20px 0" }} />
            <div style={buttonRowStyle}>
              <button type="button" disabled={Boolean(busy)} onClick={() => run("regenerate", () => regeneratePublicId(repository, tree))} style={secondaryButtonStyle}>{busy === "regenerate" ? "Regenerating…" : "Regenerate link"}</button>
              <button type="button" disabled={Boolean(busy)} onClick={() => run("unpublish", () => unpublishTree(repository, tree))} style={dangerButtonStyle}>{busy === "unpublish" ? "Unpublishing…" : "Unpublish"}</button>
            </div>
          </>
        )}
        {error && <p role="alert" style={errorStyle}>{error}</p>}
      </section>
    </div>
  );
}

const backdropStyle = { position: "fixed", inset: 0, zIndex: 60, display: "grid", placeItems: "center", padding: 16, background: "var(--backdrop)" } as const;
const dialogStyle = { width: 520, maxWidth: "100%", padding: 24, borderRadius: 20, background: "var(--panel)", border: "1px solid var(--line)", boxShadow: "var(--shadow-modal)" } as const;
const headerStyle = { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 } as const;
const titleStyle = { margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: "-.01em" } as const;
const warningStyle = { padding: 14, marginBottom: 18, borderRadius: 12, color: "var(--ink)", background: "var(--info)", fontSize: 14, lineHeight: 1.5 } as const;
const labelStyle = { display: "grid", gap: 7, color: "var(--muted)", fontSize: 12, fontWeight: 700 } as const;
const inputStyle = { width: "100%", padding: "11px 12px", borderRadius: 10, border: "1px solid var(--line)", background: "var(--input)", color: "var(--ink)" } as const;
const buttonRowStyle = { display: "flex", flexWrap: "wrap", gap: 10, marginTop: 12 } as const;
const baseButton = { minHeight: 42, padding: "0 15px", borderRadius: 10, fontWeight: 700, cursor: "pointer" } as const;
const primaryButtonStyle = { ...baseButton, border: "1px solid var(--primary)", background: "var(--primary)", color: "white" } as const;
const secondaryButtonStyle = { ...baseButton, border: "1px solid var(--line)", background: "var(--surface)", color: "var(--ink)" } as const;
const dangerButtonStyle = { ...baseButton, border: "1px solid var(--danger)", background: "transparent", color: "var(--danger)" } as const;
const quietButtonStyle = { width: 40, height: 40, display: "grid", placeItems: "center", border: 0, borderRadius: 999, background: "transparent", cursor: "pointer", color: "var(--muted)" } as const;
const metaStyle = { color: "var(--muted)", fontSize: 12, margin: "10px 0 0" } as const;
const errorStyle = { color: "var(--danger)", fontSize: 13, margin: "14px 0 0" } as const;
