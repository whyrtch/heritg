"use client";

import React from "react";
import Link from "next/link";
import { Link2, RefreshCw, Sparkles, WifiOff } from "lucide-react";
import { useT } from "@/i18n";
import { useAuth } from "@/features/auth/useAuth";
import { Dialog, dialogStyles } from "../dialogs/Dialog";
import styles from "./panels.module.css";

/** "Heritg Family+": what the owner account already includes. No prices, no payments. */
export function FamilyPlusDialog({ onClose }: { onClose: () => void }) {
  const t = useT();
  const { user } = useAuth();
  const items = [
    { icon: RefreshCw, title: t("plus.syncTitle"), text: t("plus.syncText") },
    { icon: WifiOff, title: t("plus.offlineTitle"), text: t("plus.offlineText") },
    { icon: Link2, title: t("plus.linkTitle"), text: t("plus.linkText") },
  ];
  return <Dialog title={t("shell.familyPlus")} width={620} onClose={onClose} footer={
    <button type="button" className={`${dialogStyles.button} ${dialogStyles.primary}`} onClick={onClose}>{t("plus.ok")}</button>
  }>
    <section className={styles.plusBox}>
      <h3><Sparkles size={17} aria-hidden="true" />{t("plus.benefits")}</h3>
      <ul>
        {items.map(({ icon: Icon, title, text }) => <li key={title}>
          <span className={styles.plusTile}><Icon size={18} aria-hidden="true" /></span>
          <span><strong>{title}</strong> {text}</span>
        </li>)}
      </ul>
    </section>
    <p className={styles.plusNote}>{t("plus.free")}</p>
    <p className={styles.plusStatus} data-signed-in={user ? "true" : "false"}>
      {user ? <span>{t("plus.active", { email: user.email ?? "" })}</span> : <><span>{t("plus.signedOut")}</span> <Link href="/login">{t("plus.signIn")}</Link></>}
    </p>
  </Dialog>;
}
