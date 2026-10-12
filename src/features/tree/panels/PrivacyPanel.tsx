"use client";
import React from "react";
import { Download, KeyRound, Link2, Lock, ShieldCheck, Smartphone } from "lucide-react";
import { useT } from "@/i18n";
import { SidePanel } from "./SidePanel";
import { HelpItems } from "./HelpPanel";
import packageInfo from "../../../../package.json";
import styles from "./panels.module.css";

const ITEMS = [
  { icon: Lock, title: "privacy.ownerTitle", body: "privacy.ownerBody" },
  { icon: KeyRound, title: "privacy.passwordTitle", body: "privacy.passwordBody" },
  { icon: Smartphone, title: "privacy.deviceTitle", body: "privacy.deviceBody" },
  { icon: Link2, title: "privacy.linkTitle", body: "privacy.linkBody" },
  { icon: Download, title: "privacy.exportTitle", body: "privacy.exportBody" },
] as const;

export function PrivacyPanel({ masked, onToggleMask, onClose }: { masked: boolean; onToggleMask: () => void; onClose: () => void }) {
  const t = useT();
  return <SidePanel title={t("privacy.title")} onClose={onClose}>
    <div className={styles.statusCard}>
      <ShieldCheck size={26} aria-hidden="true" />
      <div><strong>{t("privacy.cardTitle")}</strong><p>{t("privacy.cardBody")}</p></div>
    </div>
    <HelpItems items={[...ITEMS]} />
    <div className={styles.maskRow}>
      <div><strong>{t("privacy.maskTitle")}</strong><p>{t("privacy.maskBody")}</p></div>
      <button type="button" className={styles.switch} aria-pressed={masked} aria-label={t("privacy.maskTitle")} onClick={onToggleMask}><span /></button>
    </div>
    <p className={styles.version}>Heritg Web {packageInfo.version}</p>
  </SidePanel>;
}
