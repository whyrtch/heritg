"use client";

import React, { useState, type FormEvent } from "react";
import { useT } from "@/i18n";
import { NAME_MAX } from "../model";
import { Dialog, dialogStyles } from "../dialogs/Dialog";

/** "Ubah nama silsilah": one required field; used by the sidebar kebab and the title pencil. */
export function RenameTreeDialog({ name, onClose, onSave }: { name: string; onClose: () => void; onSave: (name: string) => void }) {
  const t = useT();
  const [value, setValue] = useState(name);
  const trimmed = value.trim();
  const submit = (event: FormEvent) => { event.preventDefault(); if (trimmed) onSave(trimmed); };
  return <Dialog title={t("rename.title")} width={430} onClose={onClose} initialFocus="input" footer={<>
    <button type="button" className={dialogStyles.button} onClick={onClose}>{t("common.cancel")}</button>
    <button type="submit" form="rename-tree-form" className={`${dialogStyles.button} ${dialogStyles.primary}`} disabled={!trimmed}>{t("common.save")}</button>
  </>}>
    <form id="rename-tree-form" onSubmit={submit}>
      <label className={dialogStyles.field}>{t("rename.field")}
        <input value={value} maxLength={NAME_MAX} required onChange={event => setValue(event.target.value)} />
      </label>
    </form>
  </Dialog>;
}
