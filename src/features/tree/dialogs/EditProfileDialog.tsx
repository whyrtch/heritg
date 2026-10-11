"use client";

import React, { useMemo, useState, type FormEvent } from "react";
import { CalendarHeart, Link2, Pencil, Trash2, Unlink } from "lucide-react";
import { useT } from "@/i18n";
import { displayName, type FamilyTree, type Person } from "../model";
import { statusByKey, type RelationshipStatusKey } from "../domain/relationshipStatus";
import { addRelative, familyRows, linkCandidates, removeRelationship, setMarriedOn, setRelationshipStatus, type FamilyRow } from "../domain/relativeActions";
import { AddRelativeWizard } from "./AddRelativeWizard";
import { DatePicker, formatDate } from "./DatePicker";
import { Dialog, useDiscardGuard } from "./Dialog";
import { BirthDateField, BirthOrderField, DeathDateField, GenderField, NameField, ResidenceField, StatusPicker } from "./PersonFields";
import { Avatar, PhotoPicker } from "./PhotoPicker";
import styles from "./dialogs.module.css";

const fingerprint = (tree: FamilyTree, personId: string) => JSON.stringify([tree.people.find(person => person.id === personId), tree.relationships]);

/**
 * "Edit profil <Name>": biodata, notes and the person's direct family. Family changes (status, wedding
 * date, removing a link, connecting someone) are staged on a draft and applied together on "Simpan".
 */
export function EditProfileDialog({ tree, personId, onClose, onSave, onDelete }: { tree: FamilyTree; personId: string; onClose: () => void; onSave: (tree: FamilyTree) => void; onDelete: (personId: string) => void }) {
  const t = useT();
  const months = t("date.months").split(",");
  const [draft, setDraft] = useState(tree);
  const [relationFor, setRelationFor] = useState<FamilyRow | null>(null);
  const [marriageFor, setMarriageFor] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const original = useMemo(() => fingerprint(tree, personId), [tree, personId]);
  const person = draft.people.find(item => item.id === personId)!;
  const dirty = fingerprint(draft, personId) !== original;
  const { requestClose, confirm } = useDiscardGuard(dirty, onClose);
  const rows = familyRows(draft, personId);
  const setPerson = (next: Person) => setDraft(current => ({ ...current, people: current.people.map(item => item.id === personId ? next : item) }));
  const originalName = displayName(tree.people.find(item => item.id === personId)!);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!person.name.trim()) return;
    onSave({ ...draft, people: draft.people.map(item => item.id === personId ? { ...person, name: person.name.trim(), residence: person.residence.trim(), photoUrl: person.photoUrl.trim() } : item), updatedAt: new Date().toISOString() });
  };

  return <>
    <Dialog title={t("edit.title", { name: originalName })} width={780} onClose={requestClose} footer={<>
      <button type="button" className={styles.button} onClick={requestClose}>{t("common.cancel")}</button>
      <button type="submit" form="person-editor-form" className={`${styles.button} ${styles.primary}`} disabled={!dirty || !person.name.trim()}>{t("common.save")}</button>
    </>}>
      <form id="person-editor-form" onSubmit={submit}>
        <PhotoPicker person={person} gender={person.gender} size={76} layout="inline" onChange={photoUrl => setPerson({ ...person, photoUrl })} />
        <section className={styles.card}>
          <h3>{t("edit.biodata")}</h3>
          <NameField person={person} onChange={setPerson} />
          <div className={styles.grid2}>
            <GenderField person={person} onChange={setPerson} />
            <ResidenceField person={person} onChange={setPerson} />
            <BirthDateField person={person} onChange={setPerson} />
            <BirthOrderField person={person} onChange={setPerson} />
            <DeathDateField person={person} onChange={setPerson} />
          </div>
        </section>
        <section className={styles.card}>
          <h3>{t("form.notes")}</h3>
          <label className={styles.field}><span className={styles.srOnly}>{t("form.notes")}</span><textarea maxLength={10000} value={person.notes} onChange={event => setPerson({ ...person, notes: event.target.value })} /></label>
        </section>
        <section className={styles.card} aria-label={t("edit.family")}>
          <div className={styles.familyHead}>
            <div><h3>{t("edit.family")}</h3><p>{t("edit.familyNote")}</p></div>
            <button type="button" className={styles.pill} disabled={!linkCandidates(draft, personId).length} onClick={() => setConnecting(true)}><Link2 size={16} aria-hidden="true" />{t("edit.connect")}</button>
          </div>
          {rows.map(row => {
            const name = displayName(row.person);
            const relationship = row.relationship;
            return <React.Fragment key={relationship.id}>
              <div className={styles.familyRow}>
                <Avatar person={row.person} gender={row.person.gender} size={44} />
                <div><strong>{name}</strong><span>{row.status ? t(`rel.${row.status}`) : ""}{relationship.type === "partner" && relationship.marriedOn ? ` · ${t("edit.marriedOnValue", { date: formatDate(relationship.marriedOn, months) })}` : ""}</span></div>
                <div className={styles.rowActions}>
                  {relationship.type === "partner" && <button type="button" aria-label={t("edit.editMarriage", { name })} aria-expanded={marriageFor === relationship.id} onClick={() => setMarriageFor(current => current === relationship.id ? null : relationship.id)}><CalendarHeart size={18} aria-hidden="true" /></button>}
                  <button type="button" aria-label={t("edit.editRelation", { name })} onClick={() => setRelationFor(row)}><Pencil size={17} aria-hidden="true" /></button>
                  <button type="button" className={styles.removeRow} aria-label={t("edit.removeRelation", { name })} onClick={() => setDraft(current => removeRelationship(current, relationship.id))}><Unlink size={17} aria-hidden="true" /></button>
                </div>
              </div>
              {marriageFor === relationship.id && <DatePicker label={t("wizard.marriedOn")} value={relationship.marriedOn} defaultYear={2000} onChange={value => setDraft(current => setMarriedOn(current, relationship.id, value))} />}
            </React.Fragment>;
          })}
          {!linkCandidates(draft, personId).length && <p className={styles.muted}>{t("edit.allConnected")}</p>}
        </section>
        <div className={styles.dangerZone}>
          <div><strong>{t("edit.deleteTitle")}</strong><p>{t("edit.deleteBody")}</p></div>
          <button type="button" className={`${styles.button} ${styles.dangerOutline}`} onClick={() => setDeleting(true)}><Trash2 size={16} aria-hidden="true" />{t("edit.deleteTitle")}</button>
        </div>
      </form>
    </Dialog>
    {relationFor && <RelationshipStatusDialog anchor={person} row={relationFor} onClose={() => setRelationFor(null)} onSave={(key, marriedOn) => { setDraft(setRelationshipStatus(draft, relationFor.relationship.id, personId, key, marriedOn)); setRelationFor(null); }} />}
    {connecting && <AddRelativeWizard tree={draft} anchorId={personId} startMode="link" onClose={() => setConnecting(false)} onSubmit={input => { setDraft(addRelative(draft, personId, input).tree); setConnecting(false); }} />}
    {deleting && <Dialog title={t("edit.deleteConfirmTitle", { name: originalName })} width={430} onClose={() => setDeleting(false)} footer={<>
      <button type="button" className={styles.button} onClick={() => setDeleting(false)}>{t("common.cancel")}</button>
      <button type="button" className={`${styles.button} ${styles.dangerButton}`} onClick={() => onDelete(personId)}>{t("edit.delete")}</button>
    </>}><p className={styles.confirmText}>{t("edit.deleteConfirmBody", { name: originalName })}</p></Dialog>}
    {confirm}
  </>;
}

/** "Edit status hubungan": what the other person is to the anchor, plus the wedding date for partners. */
function RelationshipStatusDialog({ anchor, row, onClose, onSave }: { anchor: Person; row: FamilyRow; onClose: () => void; onSave: (key: RelationshipStatusKey, marriedOn: string) => void }) {
  const t = useT();
  const [key, setKey] = useState<RelationshipStatusKey | null>(row.status);
  const [marriedOn, setMarried] = useState(row.relationship.marriedOn);
  const [error, setError] = useState("");
  const isPartner = key ? statusByKey(key).direction === "partner" : row.relationship.type === "partner";
  return <Dialog title={t("relEdit.title")} onClose={onClose} footer={<>
    <button type="button" className={styles.button} onClick={onClose}>{t("common.cancel")}</button>
    <button type="button" className={`${styles.button} ${styles.primary}`} disabled={!key} onClick={() => { if (!key) return; try { onSave(key, isPartner ? marriedOn : ""); } catch (failure) { setError(failure instanceof Error ? failure.message : String(failure)); } }}>{t("relEdit.save")}</button>
  </>}>
    <div className={styles.intro}><h3>{t("relEdit.question", { anchor: displayName(anchor), name: displayName(row.person) })}</h3><p>{t("relEdit.body")}</p></div>
    <div className={styles.photoRow}><Avatar person={row.person} gender={row.person.gender} size={44} /><span><small className={styles.muted}>{t("relEdit.member")}</small><br /><strong>{displayName(row.person)}</strong></span></div>
    {isPartner && <DatePicker label={t("wizard.marriedOn")} value={marriedOn} defaultYear={2000} onChange={setMarried} />}
    <StatusPicker value={key} onPick={value => { setKey(value); setError(""); }} />
    {error && <p className={styles.note} role="alert">{error}</p>}
  </Dialog>;
}
