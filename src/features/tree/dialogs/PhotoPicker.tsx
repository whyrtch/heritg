"use client";

import React, { useRef, useState } from "react";
import { ImagePlus, Link2, Trash2 } from "lucide-react";
import { useT } from "@/i18n";
import { compressPhoto, PHOTO_ACCEPT } from "../domain/photoData";
import { validatePhotoUrl } from "../domain/photoUrl";
import { displayName, type Gender, type Person } from "../model";
import styles from "./dialogs.module.css";

/** Circle avatar tinted by gender, showing the photo when there is one, else the initial (or "?"). */
export function Avatar({ person, gender, size }: { person: Pick<Person, "name" | "photoUrl" | "photo">; gender: Gender; size: number }) {
  const [broken, setBroken] = useState<string | null>(null);
  const photo = person.photoUrl || person.photo || "";
  const initial = person.name.trim() ? displayName(person).charAt(0).toUpperCase() : "?";
  return <span className={`${styles.avatar} ${styles[gender]}`} style={{ width: size, height: size, fontSize: size * .34 }} aria-hidden="true">
    {photo && broken !== photo ? <img src={photo} alt="" onError={() => setBroken(photo)} /> : initial}
  </span>;
}

export type PhotoPatch = Pick<Person, "photoUrl" | "photo">;

/**
 * "Pilih foto": choose an image file, which is shrunk in the browser to a small JPEG/WebP thumbnail
 * (≤ 256 px, ≤ 48 KB) before it is stored or uploaded. A direct HTTPS link stays available as an option.
 */
export function PhotoPicker({ person, gender, size, layout, onChange }: { person: Person; gender: Gender; size: number; layout: "card" | "row" | "inline"; onChange: (patch: PhotoPatch) => void }) {
  const t = useT();
  const input = useRef<HTMLInputElement>(null);
  const [linkMode, setLinkMode] = useState(Boolean(person.photoUrl));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const check = person.photoUrl ? validatePhotoUrl(person.photoUrl) : { ok: true as const };
  const hasPhoto = Boolean(person.photoUrl || person.photo);
  const className = layout === "card" ? styles.photoCard : layout === "row" ? styles.photoRow : styles.photoInline;

  const choose = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      onChange({ photo: await compressPhoto(file), photoUrl: "" });
      setLinkMode(false);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : t("photo.error"));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  return <div className={className}>
    <Avatar person={person} gender={gender} size={size} />
    <div className={styles.photoUrl}>
      <div className={styles.photoActions}>
        <label className={styles.pill} aria-busy={busy}>
          <ImagePlus size={17} aria-hidden="true" />{busy ? t("photo.processing") : t("photo.choose")}
          <input ref={input} className={styles.srOnly} type="file" accept={PHOTO_ACCEPT} disabled={busy} onChange={event => void choose(event.target.files?.[0])} />
        </label>
        {!linkMode && <button type="button" className={styles.pill} onClick={() => setLinkMode(true)}><Link2 size={16} aria-hidden="true" />{t("photo.useLink")}</button>}
        {hasPhoto && <button type="button" className={styles.pill} onClick={() => { onChange({ photo: "", photoUrl: "" }); setLinkMode(false); setError(""); }}><Trash2 size={16} aria-hidden="true" />{t("photo.remove")}</button>}
      </div>
      {linkMode && <label className={styles.field} style={{ marginBottom: 0, marginTop: 10 }}>{t("photo.url")}
        <input type="url" inputMode="url" placeholder="https://" value={person.photoUrl} onChange={event => onChange({ photoUrl: event.target.value, photo: "" })} aria-invalid={!check.ok} />
        <small>{check.ok ? t("photo.urlHint") : check.error}</small>
      </label>}
      {error && <p className={styles.note} role="alert">{error}</p>}
    </div>
  </div>;
}
