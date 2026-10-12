"use client";

import React, { useEffect, useRef, useState } from "react";
import { CopyPlus, EllipsisVertical, Pencil, Trash2 } from "lucide-react";
import { useT } from "@/i18n";
import styles from "./panels.module.css";

/** The kebab on a tree card: "Bikin salinan keluarga" and "Ubah nama" and "Hapus" (the example tree only offers the copy). */
export function TreeMenu({ name, example, onCopy, onRename, onDelete }: { name: string; example: boolean; onCopy: () => void; onRename: () => void; onDelete: () => void }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const kebab = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    // Capture phase so Escape closes only this menu, not the sidebar behind it.
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault(); event.stopPropagation();
      setOpen(false); kebab.current?.focus();
    };
    const onDown = (event: MouseEvent) => { if (!wrap.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("mousedown", onDown);
    return () => { document.removeEventListener("keydown", onKey, true); document.removeEventListener("mousedown", onDown); };
  }, [open]);

  const pick = (action: () => void) => () => { setOpen(false); action(); };
  return <div className={styles.menuWrap} ref={wrap}>
    <button ref={kebab} type="button" className={styles.kebab} aria-label={t("sidebar.kebab", { name })} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(value => !value)}><EllipsisVertical size={18} aria-hidden="true" /></button>
    {open && <div className={styles.popover} role="menu">
      <button type="button" role="menuitem" autoFocus onClick={pick(onCopy)}><CopyPlus size={15} aria-hidden="true" />{t("sidebar.copy")}</button>
      {!example && <button type="button" role="menuitem" onClick={pick(onRename)}><Pencil size={15} aria-hidden="true" />{t("sidebar.rename")}</button>}
      {!example && <button type="button" role="menuitem" className={styles.menuDanger} onClick={pick(onDelete)}><Trash2 size={15} aria-hidden="true" />{t("sidebar.delete")}</button>}
    </div>}
  </div>;
}
