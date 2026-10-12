"use client";

import React, { useEffect, useRef, useState } from "react";
import { CircleHelp, FileUp, Lock, Network, Plus, Search, Sparkles, X } from "lucide-react";
import { getLanguage, useT } from "@/i18n";
import { FlowerMark } from "../components/BrandMark";
import { isDemoTree } from "../demoData";
import type { FamilyTree } from "../model";
import { TreeMenu } from "./TreeMenu";
import styles from "./panels.module.css";

const LOCALES = { id: "id-ID", en: "en-GB", ms: "ms-MY" } as const;

type Props = {
  trees: FamilyTree[];
  activeId: string;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onImport: () => void;
  onCopy: (tree: FamilyTree) => void;
  onRename: (tree: FamilyTree) => void;
  onDelete: (tree: FamilyTree) => void;
  onFamilyPlus: () => void;
  onPrivacy: () => void;
  onHelp: () => void;
  onClose: () => void;
};

/** The family-tree sidebar: tree cards with a kebab, create/import, and the Family+, privacy and help rows. */
export function TreeSidebar({ trees, activeId, onSelect, onCreate, onImport, onCopy, onRename, onDelete, onFamilyPlus, onPrivacy, onHelp, onClose }: Props) {
  const t = useT();
  const [query, setQuery] = useState("");
  const asideRef = useRef<HTMLElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    asideRef.current?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape" && !event.defaultPrevented) onCloseRef.current(); };
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); previous?.focus?.(); };
  }, []);

  const needle = query.trim().toLowerCase();
  const shown = trees.filter(tree => !needle || tree.name.toLowerCase().includes(needle));
  const dateOf = (tree: FamilyTree) => new Date(tree.updatedAt).toLocaleDateString(LOCALES[getLanguage()], { day: "numeric", month: "short" });

  return <div className={styles.sidebarBackdrop} onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <aside ref={asideRef} tabIndex={-1} className={styles.sidebar} aria-label={t("sidebar.label")}>
      <div className={styles.sidebarHead}>
        <FlowerMark size={40} className={styles.logo} />
        <div className={styles.sidebarTitle}><h1>Heritg</h1><p>{t("sidebar.tagline")}</p></div>
        <button type="button" className={styles.close} onClick={onClose}><X size={20} aria-hidden="true" /><span className={styles.srOnly}>{t("dialog.close")}</span></button>
      </div>
      <div className={styles.sectionRow}>
        <h2>{t("sidebar.label")}</h2>
        <button type="button" className={styles.roundPlus} aria-label={t("sidebar.new")} onClick={onCreate}><Plus size={18} aria-hidden="true" /></button>
      </div>
      <label className={styles.treeSearch}>
        <Search size={17} aria-hidden="true" />
        <input type="search" aria-label={t("sidebar.search")} placeholder={t("sidebar.search")} value={query} onChange={event => setQuery(event.target.value)} />
      </label>
      <div className={styles.treeCards}>
        {shown.map(tree => {
          const example = isDemoTree(tree);
          return <div key={tree.id} className={styles.treeCard}>
            <button type="button" className={styles.treeOpen} aria-current={tree.id === activeId ? "true" : undefined} onClick={() => onSelect(tree.id)}>
              <span className={styles.treeAvatar}><Network size={19} aria-hidden="true" /></span>
              <span className={styles.treeText}><strong>{tree.name}</strong><small>{example ? t("sidebar.metaExample", { count: tree.people.length }) : t("sidebar.meta", { count: tree.people.length, date: dateOf(tree) })}</small></span>
            </button>
            <TreeMenu name={tree.name} example={example} onCopy={() => onCopy(tree)} onRename={() => onRename(tree)} onDelete={() => onDelete(tree)} />
          </div>;
        })}
        {shown.length === 0 && <p className={styles.none}>{t("sidebar.noMatch")}</p>}
      </div>
      <div className={styles.sidebarActions}>
        <button type="button" className={styles.sidebarPrimary} onClick={onCreate}><Plus size={18} aria-hidden="true" />{t("sidebar.new")}</button>
        <button type="button" className={styles.sidebarSecondary} onClick={onImport}><FileUp size={17} aria-hidden="true" />{t("sidebar.import")}</button>
      </div>
      <nav className={styles.sidebarMenu}>
        <button type="button" className={`${styles.menuRow} ${styles.menuPlus}`} onClick={onFamilyPlus}><Sparkles size={17} aria-hidden="true" /><span><strong>{t("shell.familyPlus")}</strong><small>{t("sidebar.plusHint")}</small></span></button>
        <button type="button" className={styles.menuRow} onClick={onPrivacy}><Lock size={17} aria-hidden="true" /><span><strong>{t("privacy.title")}</strong><small>{t("sidebar.privacyHint")}</small></span></button>
        <button type="button" className={styles.menuRow} onClick={onHelp}><CircleHelp size={17} aria-hidden="true" /><span><strong>{t("shell.help")}</strong><small>{t("sidebar.helpHint")}</small></span></button>
      </nav>
    </aside>
  </div>;
}
