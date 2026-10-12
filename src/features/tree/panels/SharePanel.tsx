"use client";
import React, { useState } from "react";
import { Download, FileImage, FileText, HardDrive, Link2, UsersRound, type LucideIcon } from "lucide-react";
import { useT, type MessageKey } from "@/i18n";
import type { ImageOptions } from "../canvas/exportImage";
import type { GedcomOptions } from "../domain/gedcom";
import { PublishCard } from "../components/PublishDialog";
import type { OnlineTree } from "../domain/onlineTypes";
import type { PublicationRepository } from "../publishing/PublicationRepository";
import { SidePanel } from "./SidePanel";
import styles from "./panels.module.css";

type Method = "link" | "backup" | "gedcom" | "image";

const METHODS: { id: Method; icon: LucideIcon; label: MessageKey; hint: MessageKey }[] = [
  { id: "link", icon: Link2, label: "share.link", hint: "share.linkHint" },
  { id: "backup", icon: HardDrive, label: "share.backup", hint: "share.backupHint" },
  { id: "gedcom", icon: FileText, label: "share.gedcom", hint: "share.gedcomHint" },
  { id: "image", icon: FileImage, label: "share.image", hint: "share.imageHint" },
];

type Props = {
  treeName: string;
  peopleCount: number;
  /** The example tree: backup works, a web link does not. */
  example: boolean;
  signedIn: boolean;
  /** Set only when the tree is synced online and publishing is available. */
  publishing: { tree: OnlineTree; repository: PublicationRepository; onTreeChange: (tree: OnlineTree) => void } | null;
  onDownload: () => void;
  onDownloadGedcom: (options: GedcomOptions) => void;
  /** Renders the displayed layout and downloads it; rejects when the image cannot be made. */
  onDownloadImage: (format: "png" | "svg", options: ImageOptions) => Promise<void>;
  onClose: () => void;
};

/** Bagikan / Ekspor: pick how to share the active tree, then use that method's card. */
export function SharePanel({ treeName, peopleCount, example, signedIn, publishing, onDownload, onDownloadGedcom, onDownloadImage, onClose }: Props) {
  const t = useT();
  const [gedcomDates, setGedcomDates] = useState(true);
  const [gedcomMarriage, setGedcomMarriage] = useState(true);
  const [imageDates, setImageDates] = useState(true);
  const [imagePhotos, setImagePhotos] = useState(true);
  const [imageBusy, setImageBusy] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const [method, setMethod] = useState<Method>(publishing ? "link" : "backup");
  const saveImage = async (format: "png" | "svg") => {
    setImageBusy(true); setImageFailed(false);
    try { await onDownloadImage(format, { dates: imageDates, photos: imagePhotos }); } catch { setImageFailed(true); } finally { setImageBusy(false); }
  };
  return <SidePanel title={t("share.title")} onClose={onClose}>
    <div className={styles.shareStack}>
      <div className={styles.scopeCard}>
        <UsersRound size={19} aria-hidden="true" />
        <div><strong>{treeName}</strong><small>{t("share.scope", { count: peopleCount })}</small></div>
      </div>
      <h3 id="share-heading" className={styles.shareHeading}>{t("share.heading")}</h3>
      <div role="group" aria-labelledby="share-heading" className={styles.methods}>
        {METHODS.map(({ id, icon: Icon, label, hint }) => <button key={id} type="button" className={styles.method} aria-pressed={method === id} aria-controls="share-method-details" onClick={() => setMethod(id)}>
          <span className={styles.methodTile}><Icon size={19} aria-hidden="true" /></span>
          <span className={styles.methodText}><strong>{t(label)}</strong><small>{t(hint)}</small></span>
        </button>)}
      </div>
      <div id="share-method-details" className={styles.detailsCard}>
        {method === "link" && (example ? <p className={styles.detailText}>{t("share.linkExample")}</p>
          : publishing ? <PublishCard tree={publishing.tree} repository={publishing.repository} onTreeChange={publishing.onTreeChange} />
          : signedIn ? <p className={styles.detailText}>{t("share.linkNeedsSync")}</p>
          : <p className={styles.detailText}>{t("share.linkSignedOut")}. <a href="/login">{t("session.signIn")}</a></p>)}
        {method === "backup" && <>
          <div className={styles.detailHead}><h4>{t("share.backup")}</h4><span className={styles.badge}>{t("share.recommended")}</span></div>
          <p className={styles.detailText}>{t("share.backupText")}</p>
          <button type="button" className={styles.shareAction} onClick={onDownload}>{t("share.backupAction")}</button>
        </>}
        {method === "gedcom" && <>
          <div className={styles.detailHead}><h4>{t("share.gedcom")}</h4><span className={styles.badge}>{t("share.gedcomBadge")}</span></div>
          <p className={styles.detailText}>{t("share.gedcomText")}</p>
          <details className={styles.options}>
            <summary>{t("share.gedcomIncludes")}</summary>
            <label><input type="checkbox" checked={gedcomDates} onChange={event => setGedcomDates(event.target.checked)} /> {t("share.gedcomDates")}</label>
            <label><input type="checkbox" checked={gedcomMarriage} onChange={event => setGedcomMarriage(event.target.checked)} /> {t("share.gedcomMarriage")}</label>
          </details>
          <button type="button" className={styles.shareAction} onClick={() => onDownloadGedcom({ dates: gedcomDates, marriageDates: gedcomMarriage })}><Download size={16} aria-hidden="true" /> {t("share.gedcomAction")}</button>
        </>}
        {method === "image" && <>
          <div className={styles.detailHead}><h4>{t("share.image")}</h4></div>
          <p className={styles.detailText}>{t("share.imageText")}</p>
          <p className={styles.detailText}>{t("share.imageWarning")}</p>
          <details className={styles.options}>
            <summary>{t("share.imageIncludes")}</summary>
            <label><input type="checkbox" checked={imageDates} onChange={event => setImageDates(event.target.checked)} /> {t("share.imageDates")}</label>
            <label><input type="checkbox" checked={imagePhotos} onChange={event => setImagePhotos(event.target.checked)} /> {t("share.imagePhotos")}</label>
            {imagePhotos && <small className={styles.detailText}>{t("share.imageNote")}</small>}
          </details>
          <div className={styles.imageActions}>
            <button type="button" className={styles.shareSecondary} disabled={imageBusy || peopleCount === 0} onClick={() => void saveImage("png")}><Download size={16} aria-hidden="true" /> {t("share.imagePng")}</button>
            <button type="button" className={styles.shareSecondary} disabled={imageBusy || peopleCount === 0} onClick={() => void saveImage("svg")}><Download size={16} aria-hidden="true" /> {t("share.imageSvg")}</button>
          </div>
          {imageBusy && <p className={styles.detailText} role="status">{t("share.imageBusy")}</p>}
          {imageFailed && <p className={styles.detailText} role="alert">{t("share.imageError")}</p>}
        </>}
      </div>
    </div>
  </SidePanel>;
}
