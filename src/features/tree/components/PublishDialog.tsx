"use client";

import React, { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { getLanguage, useT } from "@/i18n";
import type { OnlineTree } from "../domain/onlineTypes";
import { DEFAULT_PUBLISH_OPTIONS, type ExpiryDays, type PublicationInfo, type PublicationRepository, type PublishOptions } from "../publishing/PublicationRepository";
import { publishTree, regeneratePublicId, unpublishTree, updatePublishedTree } from "../publishing/publishTree";

export type PublishDialogProps = {
  tree: OnlineTree;
  repository: PublicationRepository;
  onTreeChange: (tree: OnlineTree) => void;
  onClose: () => void;
  appUrl?: string;
};

export type PublishCardProps = Omit<PublishDialogProps, "onClose">;

const EXPIRY_CHOICES: { value: string; days: ExpiryDays; label: "pub.expNone" | "pub.exp7" | "pub.exp30" | "pub.exp90" }[] = [
  { value: "none", days: null, label: "pub.expNone" }, { value: "7", days: 7, label: "pub.exp7" },
  { value: "30", days: 30, label: "pub.exp30" }, { value: "90", days: 90, label: "pub.exp90" },
];
const OPTION_CHOICES: { key: keyof PublishOptions; label: "pub.dates" | "pub.marriage" | "pub.photos" }[] = [
  { key: "dates", label: "pub.dates" }, { key: "marriageDates", label: "pub.marriage" }, { key: "photos", label: "pub.photos" },
];
const LOCALES = { id: "id-ID", en: "en-GB", ms: "ms-MY" } as const;

/** The publish UI without any modal chrome: embedded in the Bagikan panel and wrapped by PublishDialog. */
export function PublishCard({ tree, repository, onTreeChange, appUrl }: PublishCardProps) {
  const t = useT();
  const [options, setOptions] = useState<PublishOptions>(DEFAULT_PUBLISH_OPTIONS);
  const [expiry, setExpiry] = useState("none");
  // What the owner changed: untouched fields are not sent on update, so the server keeps the stored value.
  const [optionsTouched, setOptionsTouched] = useState(false);
  const [expiryTouched, setExpiryTouched] = useState(false);
  const [loaded, setLoaded] = useState<"loading" | "ready" | "failed">("loading");
  const [reload, setReload] = useState(0);
  const [info, setInfo] = useState<PublicationInfo | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const publicUrl = useMemo(() => {
    if (!tree.publicId) return "";
    const base = appUrl ?? (typeof window === "undefined" ? "" : window.location.origin);
    return `${base.replace(/\/$/, "")}/tree/${tree.publicId}`;
  }, [appUrl, tree.publicId]);

  const isPublished = tree.visibility === "unlisted" && Boolean(tree.publicId);
  // The stored settings come from the server, so an update never silently resets what the link shows.
  useEffect(() => {
    if (!isPublished) { setInfo(null); setLoaded("ready"); return; }
    let cancelled = false;
    setLoaded("loading");
    repository.getPublication(tree).then(stored => {
      if (cancelled) return;
      setInfo(stored);
      if (stored) { setOptions(stored.options); setOptionsTouched(false); setExpiry(stored.expiresAt ? "keep" : "none"); setExpiryTouched(false); }
      setLoaded("ready");
    }).catch(() => { if (!cancelled) { setLoaded("failed"); setError(t("pub.settingsFailed")); } });
    return () => { cancelled = true; };
    // Reload when the link changes or after this card publishes (reload), not on every autosave: that would wipe half-made choices.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPublished, tree.publicId, repository, reload]);
  const chosenDays = EXPIRY_CHOICES.find(choice => choice.value === expiry)?.days ?? null;
  // A first publish sends the chosen values; later ones send only what the owner changed.
  const settings = isPublished && info
    ? { options: optionsTouched ? options : undefined, expiresInDays: expiryTouched && expiry !== "keep" ? chosenDays : undefined }
    : { options, expiresInDays: chosenDays };
  const settingsPending = isPublished && loaded !== "ready";

  const run = async (label: string, action: () => Promise<OnlineTree>) => {
    setBusy(label);
    setError("");
    try {
      onTreeChange(await action());
      setReload(value => value + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("pub.failed"));
    } finally {
      setBusy(null);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
    } catch {
      setError(t("pub.copyFailed"));
    }
  };

  const expired = Boolean(info?.expiresAt && Date.parse(info.expiresAt) <= Date.now());
  const expiresOn = info?.expiresAt ? new Date(info.expiresAt).toLocaleDateString(LOCALES[getLanguage()], { day: "numeric", month: "long", year: "numeric" }) : "";
  return (
    <div>
        <div style={warningStyle}>
          {t("pub.warning")}
        </div>

        <details style={detailsStyle}>
          <summary style={summaryStyle}>{t("pub.includes")}</summary>
          {OPTION_CHOICES.map(({ key, label }) => <label key={key} style={checkStyle}>
            <input type="checkbox" checked={options[key]} disabled={settingsPending} onChange={event => { setOptions({ ...options, [key]: event.target.checked }); setOptionsTouched(true); }} /> {t(label)}
          </label>)}
          <small style={metaStyle}>{t("pub.always")}</small>
        </details>
        <label style={{ ...labelStyle, marginBottom: 18 }}>{t("pub.expiry")}
          <select value={expiry} disabled={settingsPending} onChange={event => { setExpiry(event.target.value); setExpiryTouched(true); }} style={inputStyle}>
            {info?.expiresAt && <option value="keep">{expired ? t("pub.expKeepExpired") : t("pub.expKeep", { date: expiresOn })}</option>}
            {EXPIRY_CHOICES.map(choice => <option key={choice.value} value={choice.value}>{t(choice.label)}</option>)}
          </select>
        </label>

        {!isPublished ? (
          <button type="button" disabled={Boolean(busy)} onClick={() => run("publish", () => publishTree(repository, tree, settings))} style={primaryButtonStyle}>
            {busy === "publish" ? t("pub.publishing") : t("pub.publish")}
          </button>
        ) : (
          <>
            <label style={labelStyle}>{t("pub.publicLink")}<input aria-label={t("pub.publicLink")} readOnly value={publicUrl} style={inputStyle} /></label>
            <div style={buttonRowStyle}>
              <button type="button" disabled={Boolean(busy)} onClick={copy} style={primaryButtonStyle}>{copied ? t("pub.copied") : t("pub.copy")}</button>
              <button type="button" disabled={Boolean(busy) || settingsPending} onClick={() => run("update", () => updatePublishedTree(repository, tree, settings))} style={secondaryButtonStyle}>{busy === "update" ? t("pub.updating") : t("pub.update")}</button>
            </div>
            <p style={metaStyle}>{tree.publishedRevision !== tree.revision ? t("pub.versionBehind", { version: tree.publishedRevision ?? "—" }) : t("pub.versionCurrent", { version: tree.publishedRevision })}</p>
            {expired ? <p role="status" style={{ ...metaStyle, color: "var(--danger)", fontWeight: 700 }}>{t("pub.expired")} <span style={{ fontWeight: 400 }}>{t("pub.expiredHint")}</span></p>
              : expiresOn && <p style={metaStyle}>{t("pub.expiresOn", { date: expiresOn })}</p>}
            {loaded === "failed" && <button type="button" onClick={() => { setError(""); setReload(value => value + 1); }} style={secondaryButtonStyle}>{t("pub.retry")}</button>}
            <hr style={{ border: 0, borderTop: "1px solid var(--line)", margin: "20px 0" }} />
            <div style={buttonRowStyle}>
              <button type="button" disabled={Boolean(busy) || settingsPending} onClick={() => run("regenerate", () => regeneratePublicId(repository, tree, settings))} style={secondaryButtonStyle}>{busy === "regenerate" ? t("pub.regenerating") : t("pub.regenerate")}</button>
              <button type="button" disabled={Boolean(busy)} onClick={() => run("unpublish", () => unpublishTree(repository, tree))} style={dangerButtonStyle}>{busy === "unpublish" ? t("pub.unpublishing") : t("pub.unpublish")}</button>
            </div>
          </>
        )}
        {error && <p role="alert" style={errorStyle}>{error}</p>}
    </div>
  );
}

export function PublishDialog({ onClose, ...card }: PublishDialogProps) {
  const t = useT();
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="publish-title" style={backdropStyle}>
      <section style={dialogStyle}>
        <header style={headerStyle}>
          <h2 id="publish-title" style={titleStyle}>{t("pub.title")}</h2>
          <button type="button" aria-label={t("pub.close")} onClick={onClose} style={quietButtonStyle}><X size={20} aria-hidden="true" /></button>
        </header>
        <PublishCard {...card} />
      </section>
    </div>
  );
}

const backdropStyle = { position: "fixed", inset: 0, zIndex: 60, display: "grid", placeItems: "center", padding: 16, background: "var(--backdrop)" } as const;
const dialogStyle = { width: 520, maxWidth: "100%", padding: 24, borderRadius: 20, background: "var(--panel)", border: "1px solid var(--line)", boxShadow: "var(--shadow-modal)" } as const;
const headerStyle = { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 } as const;
const titleStyle = { margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: "-.01em" } as const;
const warningStyle = { padding: 14, marginBottom: 18, borderRadius: 12, color: "var(--ink)", background: "var(--info)", fontSize: 14, lineHeight: 1.5 } as const;
const detailsStyle = { padding: "10px 12px", marginBottom: 14, borderRadius: 12, border: "1px solid var(--line)", background: "var(--base)", fontSize: 14 } as const;
const summaryStyle = { cursor: "pointer", fontWeight: 700 } as const;
const checkStyle = { display: "flex", alignItems: "center", gap: 8, marginTop: 8, color: "var(--muted)" } as const;
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
