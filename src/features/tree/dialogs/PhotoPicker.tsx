"use client";

import React, { useState } from "react";
import { ImagePlus } from "lucide-react";
import { useT } from "@/i18n";
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

/**
 * "Pilih foto". Photos stay HTTPS links (AGENTS.md hard rule: no uploads), so choosing a photo opens a
 * link field under the avatar. A file-upload picker needs an owner decision first (see the Phase 3 note).
 */
export function PhotoPicker({ person, gender, size, layout, onChange }: { person: Person; gender: Gender; size: number; layout: "card" | "row" | "inline"; onChange: (photoUrl: string) => void }) {
  const t = useT();
  const [open, setOpen] = useState(Boolean(person.photoUrl));
  const check = person.photoUrl ? validatePhotoUrl(person.photoUrl) : { ok: true as const };
  const className = layout === "card" ? styles.photoCard : layout === "row" ? styles.photoRow : styles.photoInline;
  return <div className={className}>
    <Avatar person={person} gender={gender} size={size} />
    <div className={styles.photoUrl}>
      {!open && <button type="button" className={styles.pill} onClick={() => setOpen(true)}><ImagePlus size={17} aria-hidden="true" />{t("photo.choose")}</button>}
      {open && <label className={styles.field} style={{ marginBottom: 0 }}>{t("photo.url")}
        <input type="url" inputMode="url" placeholder="https://" value={person.photoUrl} onChange={event => onChange(event.target.value)} aria-invalid={!check.ok} />
        <small>{check.ok ? t("photo.urlHint") : check.error}</small>
      </label>}
    </div>
  </div>;
}
