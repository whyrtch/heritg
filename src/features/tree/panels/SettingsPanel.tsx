"use client";
import React from "react";
import { Cloud, ShieldCheck, Smartphone, Sparkles, UserRound } from "lucide-react";
import { getLanguage, setLanguage, useT, type Language, type MessageKey } from "@/i18n";
import { useAuth } from "@/features/auth/useAuth";
import { OwnerSession } from "@/features/auth/OwnerSession";
import type { SyncStatus } from "../sync/types";
import type { KinshipDialect } from "../canvas/kinship";
import { KINSHIP_DIALECTS } from "../canvas/kinshipTerms";
import { setDialect, useDialect } from "../canvas/dialectSetting";
import { SidePanel } from "./SidePanel";
import packageInfo from "../../../../package.json";
import styles from "./panels.module.css";

export type SyncReport = { status: SyncStatus; error: string | null };
export type SyncPill = "saved" | "saving" | "offline" | "check" | "local";

/** Maps the active tree's sync state to the pill shown in Setelan. `report` is null when the tree is not synced online. */
export function syncPill(report: SyncReport | null, signedIn: boolean): SyncPill {
  if (!report || !signedIn) return "local";
  if (report.error || report.status === "conflict") return "check";
  // public-stale: the tree itself is saved; only the published copy is older (the share dialog says so).
  if (report.status === "public-stale") return "saved";
  if (report.status === "offline") return "offline";
  if (report.status === "saved") return "saved";
  return "saving";
}

const PILL_KEYS: Record<SyncPill, MessageKey> = {
  saved: "settings.syncSaved", saving: "settings.syncSaving", offline: "settings.syncOffline", check: "settings.syncCheck", local: "settings.syncLocal",
};
const LANGUAGES: { value: Language; key: MessageKey }[] = [
  { value: "id", key: "settings.langId" }, { value: "en", key: "settings.langEn" }, { value: "ms", key: "settings.langMs" },
];
const DIALECT_KEYS: Record<KinshipDialect, MessageKey> = {
  id: "settings.dialectId", "jv-yogya": "settings.dialectJv", ms: "settings.dialectMs", en: "settings.dialectEn",
};

export function SettingsPanel({ syncReport, onFamilyPlus, onClose }: { syncReport: SyncReport | null; onFamilyPlus: () => void; onClose: () => void }) {
  const t = useT();
  const { user } = useAuth();
  const language = getLanguage();
  const dialect = useDialect();
  const pill = syncPill(syncReport, !!user);
  const resetCache = () => {
    if (window.confirm(t("settings.resetConfirm"))) { window.localStorage.clear(); window.location.reload(); }
  };
  return <SidePanel title={t("shell.settings")} onClose={onClose}>
    <div className={styles.groups}>
      <section className={styles.group} aria-labelledby="set-plus">
        <h3 id="set-plus">{t("settings.plusGroup")}</h3>
        <div className={`${styles.card} ${styles.plusCard}`}>
          <div className={styles.cardHead}>
            <Sparkles size={25} aria-hidden="true" />
            <div><strong>{t("shell.familyPlus")} <span className={styles.badge}>{t(user ? "settings.active" : "settings.inactive")}</span></strong><p>{t("settings.plusDetail")}</p></div>
          </div>
          <div className={styles.syncRow}><Cloud size={17} aria-hidden="true" /><span>{t("settings.syncOnline")}</span><span className={`${styles.badge} ${styles.pill}`} data-pill={pill}>{t(PILL_KEYS[pill])}</span></div>
          <button type="button" className={styles.plusButton} onClick={onFamilyPlus}>{t("settings.plusAction")}</button>
        </div>
      </section>
      <section className={styles.group} aria-labelledby="set-account">
        <h3 id="set-account">{t("settings.accountGroup")}</h3>
        <div className={styles.card}>
          <div className={styles.cardHead}><UserRound size={25} aria-hidden="true" /><div><strong>{t("settings.owner")}</strong><p>{user?.email ?? t("settings.signedOut")}</p></div></div>
          <OwnerSession />
        </div>
      </section>
      <section className={styles.group} aria-labelledby="set-lang">
        <h3 id="set-lang">{t("settings.langGroup")}</h3>
        <div className={styles.options}>
          {LANGUAGES.map(option => <button key={option.value} type="button" aria-pressed={language === option.value} onClick={() => setLanguage(option.value)}>{t(option.key)}</button>)}
        </div>
      </section>
      <section className={styles.group} aria-labelledby="set-dialect">
        <h3 id="set-dialect">{t("settings.dialectGroup")}</h3>
        <div className={styles.options}>
          {KINSHIP_DIALECTS.map(option => <button key={option} type="button" aria-pressed={dialect === option} onClick={() => setDialect(option)}>{t(DIALECT_KEYS[option])}</button>)}
        </div>
      </section>
      <section className={styles.group} aria-labelledby="set-device">
        <h3 id="set-device">{t("settings.deviceGroup")}</h3>
        <div className={styles.card}>
          <div className={styles.cardHead}><Smartphone size={25} aria-hidden="true" /><div><strong>{t("settings.deviceTitle")}</strong><p>{t("settings.deviceDetail")}</p></div></div>
          <button type="button" className={styles.resetButton} onClick={resetCache}>{t("settings.reset")}</button>
        </div>
      </section>
    </div>
    <footer className={styles.settingsFoot}>
      <p className={styles.note}><ShieldCheck size={17} aria-hidden="true" /><span>{t("settings.note")}</span></p>
      <p className={styles.version}>Heritg Web {packageInfo.version}</p>
    </footer>
  </SidePanel>;
}
