"use client";

import React, { useState, type FormEvent } from "react";
import { Plus } from "lucide-react";
import { useT } from "@/i18n";
import { emptyPerson, type Person } from "../model";
import { Dialog, useDiscardGuard } from "./Dialog";
import { BirthDateField, BirthOrderField, DeathDateField, NameField, ResidenceField } from "./PersonFields";
import { PhotoPicker } from "./PhotoPicker";
import styles from "./dialogs.module.css";

const isDirty = (person: Person) => Boolean(person.name.trim() || person.photoUrl || person.photo || person.birthDate || person.deathDate || person.residence || person.birthOrder);

/** "Mulai bikin silsilah": the first person of an empty tree. */
export function StartDialog({ onClose, onSave }: { onClose: () => void; onSave: (person: Person) => void }) {
  const t = useT();
  const [person, setPerson] = useState<Person>(emptyPerson);
  const { requestClose, confirm } = useDiscardGuard(isDirty(person), onClose);
  const submit = (event: FormEvent) => { event.preventDefault(); if (person.name.trim()) onSave({ ...person, name: person.name.trim(), residence: person.residence.trim(), photoUrl: person.photoUrl.trim() }); };
  return <>
    <Dialog title={t("start.title")} onClose={requestClose} initialFocus='input[autocomplete="name"]' footer={<>
      <button type="button" className={styles.button} onClick={requestClose}>{t("common.cancel")}</button>
      <button type="submit" form="start-person-form" className={`${styles.button} ${styles.primary}`} disabled={!person.name.trim()}>{t("start.submit")}</button>
    </>}>
      <form id="start-person-form" onSubmit={submit}>
        <PhotoPicker person={person} gender={person.gender} size={76} layout="card" onChange={patch => setPerson({ ...person, ...patch })} />
        <NameField person={person} onChange={setPerson} big />
        <details className={styles.details}>
          <summary>{t("form.more")}<Plus size={16} aria-hidden="true" /></summary>
          <div>
            <BirthDateField person={person} onChange={setPerson} />
            <BirthOrderField person={person} onChange={setPerson} />
            <DeathDateField person={person} onChange={setPerson} />
            <ResidenceField person={person} onChange={setPerson} />
          </div>
        </details>
      </form>
    </Dialog>
    {confirm}
  </>;
}
