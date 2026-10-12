"use client";

import React, { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { getLanguage, useT } from "@/i18n";
import type { OnlineTree } from "../domain/onlineTypes";
import { checkPassword } from "../domain/passwordRules";
import { PasswordField } from "../panels/PasswordField";
import { encryptSnapshot, SnapshotTooLargeError } from "../publishing/buildSnapshot";
import type { EncryptedEnvelope } from "../domain/secureFile";
import { DEFAULT_PUBLISH_OPTIONS, type ExpiryDays, type PublicationInfo, type PublicationRepository, type PublishOptions, type PublishSettings } from "../publishing/PublicationRepository";
import { publishTree, regeneratePublicId, unpublishTree, updatePublishedTree } from "../publishing/publishTree";

export type PublishDialogProps = {
  tree: OnlineTree;
  repository: PublicationRepository;
  onTreeChange: (tree: OnlineTree) => void;
  onClose: () => void;
  appUrl?: string;
};

type PublishSettingsWithEnvelope = PublishSettings & { encrypted: EncryptedEnvelope };
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
  // Password mode: the password lives only in these two fields and is cleared once the link is made.
  const [mode, setMode] = useState<"plain" | "password">("plain");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
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
      if (stored) { setMode(stored.mode ?? "plain"); setOptions(stored.options); setOptionsTouched(false); setExpiry(stored.expiresAt ? "keep" : "none"); setExpiryTouched(false); }
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
  const storedMode = info?.mode ?? "plain";
  const passwordMode = mode === "password";
  const mismatch = passwordMode && confirm !== "" && confirm !== password;
  const passwordReady = checkPassword(password).ok && confirm === password;
  // Regenerate keeps whatever the link is now (the server moves the ciphertext of a protected link), so it never carries a mode.
  // Plain mode on a protected link switches it to plain; password mode always sends the freshly encrypted snapshot (options and content live inside it).
  const plainSettings = isPublished && storedMode === "password" ? { ...settings, mode: "plain" as const } : settings;
  // A regenerate moves the stored ciphertext as it is, so it can never carry options: those only change together with a new password.
  const regenerateSettings: PublishSettings = { expiresInDays: settings.expiresInDays };
  const optionsNeedPassword = isPublished && storedMode === "password" && optionsTouched;
  const lockAnd = async (publish: (settings: PublishSettingsWithEnvelope) => Promise<OnlineTree>) => {
    const secret = password;
    const envelope = await encryptSnapshot(tree, options, secret);
    setPassword(""); setConfirm("");
    return publish({ ...settings, options, encrypted: envelope });
  };

  const run = async (label: string, action: () => Promise<OnlineTree>) => {
    setBusy(label);
    setError("");
    try {
      onTreeChange(await action());
      setReload(value => value + 1);
    } catch (cause) {
      setError(cause instanceof SnapshotTooLargeError ? t("pub.pwTooLarge") : cause instanceof Error ? cause.message : t("pub.failed"));
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
        <div role="radiogroup" aria-label={t("pub.modeLabel")} style={modeRowStyle}>
          {(["plain", "password"] as const).map(value => <label key={value} style={{ ...modeStyle, ...(mode === value ? modeActiveStyle : {}) }}>
            <input type="radio" name="link-mode" value={value} checked={mode === value} disabled={Boolean(busy)} onChange={() => setMode(value)} style={{ accentColor: "var(--primary)" }} /> {t(value === "plain" ? "pub.modePlain" : "pub.modePassword")}
          </label>)}
        </div>
        <div style={warningStyle}>
          {passwordMode ? t("pub.pwWarning") : t("pub.warning")}
        </div>
        {passwordMode && <div style={{ marginBottom: 18 }}>
          <PasswordField label={t("pub.pwLabel")} value={password} onChange={setPassword} checklist />
          <PasswordField label={t("pub.pwConfirm")} value={confirm} onChange={setConfirm} invalid={mismatch} />
          {mismatch && <p role="alert" style={errorStyle}>{t("pub.pwMismatch")}</p>}
          <p style={metaStyle}>{t("pub.pwSeparate")}</p>
          <p style={metaStyle}>{t("pub.pwNameVisible")}</p>
          {isPublished && storedMode === "password" && <p style={metaStyle}>{t("pub.pwUpdateHint")}</p>}
        </div>}
        {!passwordMode && isPublished && storedMode === "password" && <p style={{ ...metaStyle, margin: "0 0 14px" }}>{t("pub.pwToPlain")}</p>}

        <details style={detailsStyle}>
          <summary style={summaryStyle}>{t("pub.includes")}</summary>
          {OPTION_CHOICES.map(({ key, label }) => <label key={key} style={checkStyle}>
            <input type="checkbox" checked={options[key]} disabled={settingsPending} onChange={event => { setOptions({ ...options, [key]: event.target.checked }); setOptionsTouched(true); }} /> {t(label)}
          </label>)}
          <small style={metaStyle}>{t("pub.always")}</small>
          {isPublished && storedMode === "password" && <small role="note" style={{ ...metaStyle, display: "block" }}>{t("pub.pwOptionsHint")}</small>}
        </details>
        <label style={{ ...labelStyle, marginBottom: 18 }}>{t("pub.expiry")}
          <select value={expiry} disabled={settingsPending} onChange={event => { setExpiry(event.target.value); setExpiryTouched(true); }} style={inputStyle}>
            {info?.expiresAt && <option value="keep">{expired ? t("pub.expKeepExpired") : t("pub.expKeep", { date: expiresOn })}</option>}
            {EXPIRY_CHOICES.map(choice => <option key={choice.value} value={choice.value}>{t(choice.label)}</option>)}
          </select>
        </label>

        {!isPublished ? (
          <button type="button" disabled={Boolean(busy) || (passwordMode && !passwordReady)} onClick={() => run("publish", () => passwordMode ? lockAnd(withEnvelope => publishTree(repository, tree, withEnvelope)) : publishTree(repository, tree, settings))} style={primaryButtonStyle}>
            {busy === "publish" ? (passwordMode ? t("pub.pwLocking") : t("pub.publishing")) : t(passwordMode ? "pub.pwPublish" : "pub.publish")}
          </button>
        ) : (
          <>
            {storedMode === "password" && <p style={{ ...metaStyle, margin: "0 0 12px", fontWeight: 700 }}>{t("pub.pwActive")}</p>}
            <label style={labelStyle}>{t("pub.publicLink")}<input aria-label={t("pub.publicLink")} readOnly value={publicUrl} style={inputStyle} /></label>
            <div style={buttonRowStyle}>
              <button type="button" disabled={Boolean(busy)} onClick={copy} style={primaryButtonStyle}>{copied ? t("pub.copied") : t("pub.copy")}</button>
              <button type="button" disabled={Boolean(busy) || settingsPending || (passwordMode && !passwordReady)} onClick={() => run("update", () => passwordMode ? lockAnd(withEnvelope => updatePublishedTree(repository, tree, withEnvelope)) : updatePublishedTree(repository, tree, plainSettings))} style={secondaryButtonStyle}>{busy === "update" ? (passwordMode ? t("pub.pwLocking") : t("pub.updating")) : t("pub.update")}</button>
            </div>
            <p style={metaStyle}>{tree.publishedRevision !== tree.revision ? t("pub.versionBehind", { version: tree.publishedRevision ?? "—" }) : t("pub.versionCurrent", { version: tree.publishedRevision })}</p>
            {expired ? <p role="status" style={{ ...metaStyle, color: "var(--danger)", fontWeight: 700 }}>{t("pub.expired")} <span style={{ fontWeight: 400 }}>{t("pub.expiredHint")}</span></p>
              : expiresOn && <p style={metaStyle}>{t("pub.expiresOn", { date: expiresOn })}</p>}
            {loaded === "failed" && <button type="button" onClick={() => { setError(""); setReload(value => value + 1); }} style={secondaryButtonStyle}>{t("pub.retry")}</button>}
            <hr style={{ border: 0, borderTop: "1px solid var(--line)", margin: "20px 0" }} />
            <div style={buttonRowStyle}>
              <button type="button" disabled={Boolean(busy) || settingsPending || optionsNeedPassword} onClick={() => run("regenerate", () => regeneratePublicId(repository, tree, storedMode === "password" ? regenerateSettings : settings))} style={secondaryButtonStyle}>{busy === "regenerate" ? t("pub.regenerating") : t("pub.regenerate")}</button>
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
const modeRowStyle = { display: "flex", gap: 8, marginBottom: 14 } as const;
const modeStyle = { flex: 1, display: "flex", alignItems: "center", gap: 8, minHeight: 44, padding: "0 12px", borderRadius: 10, borderWidth: 1, borderStyle: "solid", borderColor: "var(--line)", background: "var(--surface)", color: "var(--ink)", fontSize: 14, fontWeight: 700, cursor: "pointer" } as const;
const modeActiveStyle = { borderColor: "var(--primary)", background: "var(--primary-soft)" } as const;
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
