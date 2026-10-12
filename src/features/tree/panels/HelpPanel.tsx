"use client";
import React from "react";
import { GitBranch, Hand, ListTree, Search, UserPlus, Waypoints, type LucideIcon } from "lucide-react";
import { useT, type MessageKey } from "@/i18n";
import { SidePanel } from "./SidePanel";
import styles from "./panels.module.css";

export const HELP_ITEMS: { icon: LucideIcon; title: MessageKey; body: MessageKey }[] = [
  { icon: Hand, title: "help.panTitle", body: "help.panBody" },
  { icon: UserPlus, title: "help.editTitle", body: "help.editBody" },
  { icon: ListTree, title: "help.treesTitle", body: "help.treesBody" },
  { icon: Search, title: "help.findTitle", body: "help.findBody" },
  { icon: GitBranch, title: "help.viewsTitle", body: "help.viewsBody" },
  { icon: Waypoints, title: "help.syncTitle", body: "help.syncBody" },
];

/** Icon tile + h3 + p rows shared by the Bantuan and Perlindungan privasi panels. */
export function HelpItems({ items }: { items: { icon: LucideIcon; title: MessageKey; body: MessageKey }[] }) {
  const t = useT();
  return <div className={styles.helpList}>
    {items.map(({ icon: Icon, title, body }) => <section key={title} className={styles.helpItem}>
      <span className={styles.helpTile} aria-hidden="true"><Icon size={19} /></span>
      <div><h3>{t(title)}</h3><p>{t(body)}</p></div>
    </section>)}
  </div>;
}

export function HelpPanel({ onClose }: { onClose: () => void }) {
  const t = useT();
  return <SidePanel title={t("shell.help")} onClose={onClose}>
    <p className={styles.helpIntro}>{t("help.intro")}</p>
    <HelpItems items={HELP_ITEMS} />
  </SidePanel>;
}
