"use client";
import React, { useState } from "react";
import { ArrowRight, Search } from "lucide-react";
import { useT } from "@/i18n";
import { displayName, type FamilyTree } from "../model";
import { SidePanel } from "./SidePanel";
import styles from "./panels.module.css";

type PeoplePanelProps = { tree: FamilyTree; selectedId: string | null; labels?: Map<string, string>; privacy: boolean; onPick: (id: string) => void; onClose: () => void };

/** "Semua orang": searchable list of everyone in the tree; picking a row focuses that person. */
export function PeoplePanel({ tree, selectedId, labels, privacy, onPick, onClose }: PeoplePanelProps) {
  const t = useT();
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const people = tree.people.filter(person => displayName(person).toLowerCase().includes(needle));
  return <SidePanel title={t("shell.allPeople")} onClose={onClose}>
    <div className={styles.searchBlock}>
      <label className={styles.search}>
        <Search size={18} aria-hidden="true" />
        <input type="search" autoFocus aria-label={t("people.search")} placeholder={t("people.search")} value={query} onChange={event => setQuery(event.target.value)} />
      </label>
    </div>
    <div className={styles.list}>
      {people.map(person => {
        const name = displayName(person);
        const photo = privacy ? "" : person.photoUrl || person.photo;
        const subline = person.id === selectedId ? t("people.selected") : labels?.get(person.id) ?? t("people.member");
        return <button key={person.id} type="button" className={styles.row} onClick={() => onPick(person.id)}>
          <span className={`${styles.avatar} ${styles[person.gender] ?? ""}`}>{photo ? <img src={photo} alt="" /> : name[0]}</span>
          <span className={styles.who}><strong>{name}</strong><small>{subline}</small></span>
          <ArrowRight size={17} aria-hidden="true" />
        </button>;
      })}
      {!people.length && <p className={styles.none}>{t("people.none")}</p>}
    </div>
  </SidePanel>;
}
