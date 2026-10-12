"use client";

import React, { useState, type FormEvent } from "react";
import { Link2, Plus, UserPlus } from "lucide-react";
import { useT } from "@/i18n";
import { displayName, emptyPerson, type FamilyTree, type Person } from "../model";
import { statusByKey, type RelationshipStatusKey } from "../domain/relationshipStatus";
import { linkCandidates, partnersOf, type AddRelativeInput } from "../domain/relativeActions";
import { DatePicker } from "./DatePicker";
import { Dialog, useDiscardGuard } from "./Dialog";
import { BirthDateField, NameField, ResidenceField, StatusPicker } from "./PersonFields";
import { Avatar, PhotoPicker } from "./PhotoPicker";
import styles from "./dialogs.module.css";

type Mode = "new" | "link";

function Stepper({ step }: { step: 1 | 2 | 3 }) {
  const t = useT();
  const label = t("wizard.step", { n: step });
  return <div className={styles.stepper} aria-label={label}>
    {[1, 2, 3].map(n => <React.Fragment key={n}>{n > 1 && <i className={n <= step ? styles.on : ""} />}<span className={n <= step ? styles.on : ""}>{n}</span></React.Fragment>)}
    <strong>{label}</strong>
  </div>;
}

/**
 * "Tambah kerabatnya <Name>" (heritg.us): 1) new person or connect an existing one, 2) relationship status,
 * 3) the new person's profile, or which existing person to connect. `onSubmit` may throw (duplicate link,
 * family cycle); the message is shown in the dialog.
 */
export function AddRelativeWizard({ tree, anchorId, startMode, onClose, onSubmit }: { tree: FamilyTree; anchorId: string; startMode?: Mode; onClose: () => void; onSubmit: (input: AddRelativeInput) => void }) {
  const t = useT();
  const anchor = tree.people.find(person => person.id === anchorId)!;
  const anchorName = displayName(anchor);
  const candidates = linkCandidates(tree, anchorId);
  const [step, setStep] = useState<1 | 2 | 3>(startMode ? 2 : 1);
  const [mode, setMode] = useState<Mode>(startMode ?? "new");
  const [status, setStatus] = useState<RelationshipStatusKey | null>(null);
  const [person, setPerson] = useState<Person>(emptyPerson);
  const [existingId, setExistingId] = useState<string | null>(null);
  const [marriedOn, setMarriedOn] = useState("");
  const [coParentId, setCoParentId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const dirty = Boolean(person.name.trim() || person.photoUrl || person.photo || person.birthDate || person.residence || existingId || marriedOn || coParentId);
  const { requestClose, confirm } = useDiscardGuard(dirty, onClose);

  const info = status ? statusByKey(status) : null;
  const statusLabel = status ? t(`rel.${status}`) : "";
  const impliedGender = person.gender !== "unspecified" ? person.gender : info?.gender ?? "unspecified";
  const coParents = info?.direction === "child" ? partnersOf(tree, anchorId) : [];

  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    if (!status) return;
    try {
      if (mode === "new") {
        if (!person.name.trim()) return;
        onSubmit({ status, person: { ...person, name: person.name.trim(), residence: person.residence.trim(), photoUrl: person.photoUrl.trim() }, marriedOn, coParentId });
      } else {
        if (!existingId) return;
        onSubmit({ status, existingId, marriedOn });
      }
    } catch (failure) { setError(failure instanceof Error ? failure.message : String(failure)); }
  };

  const footer = step === 1
    ? <button type="button" className={styles.button} onClick={requestClose}>{t("common.cancel")}</button>
    : step === 2
      ? <>{!startMode && <button type="button" className={styles.button} onClick={() => setStep(1)}>{t("common.back")}</button>}<button type="button" className={styles.button} onClick={requestClose}>{t("common.cancel")}</button></>
      : <>
        <button type="button" className={styles.button} onClick={() => { setStep(2); setError(""); }}>{t("common.back")}</button>
        {mode === "new"
          ? <button type="submit" form="add-relative-form" className={`${styles.button} ${styles.add}`} disabled={!person.name.trim()}>{t("wizard.submit")}</button>
          : <button type="submit" form="add-relative-form" className={`${styles.button} ${styles.primary}`} disabled={!existingId}>{t("wizard.linkSubmit")}</button>}
      </>;

  return <>
    <Dialog title={t("wizard.title", { name: anchorName })} onClose={requestClose} footer={footer}>
      <Stepper step={step} />
      {step === 1 && <>
        <div className={styles.intro}><h3>{t("wizard.howTitle")}</h3><p>{t("wizard.howBody", { name: anchorName })}</p></div>
        <div className={styles.choices}>
          <button type="button" className={styles.choice} onClick={() => { setMode("new"); setStep(2); }}><span><UserPlus size={18} aria-hidden="true" /></span><span><strong>{t("wizard.new")}</strong><small>{t("wizard.newHint")}</small></span></button>
          <button type="button" className={styles.choice} disabled={!candidates.length} onClick={() => { setMode("link"); setStep(2); }}><span><Link2 size={18} aria-hidden="true" /></span><span><strong>{t("wizard.link")}</strong><small>{t("wizard.linkHint")}</small></span></button>
        </div>
        {!candidates.length && <p className={styles.note}>{t("wizard.linkNone")}</p>}
      </>}
      {step === 2 && <>
        <div className={styles.intro}><h3>{t("wizard.statusTitle")}</h3><p>{t("wizard.statusBody", { name: anchorName })}</p></div>
        <StatusPicker value={status} onPick={key => { setStatus(key); setStep(3); setError(""); }} />
      </>}
      {step === 3 && status && <form id="add-relative-form" onSubmit={submit}>
        <div className={styles.intro}>
          <h3>{mode === "new" ? t("wizard.profileTitle", { status: statusLabel }) : t("wizard.pickTitle", { status: statusLabel })}</h3>
          <p>{mode === "new" ? t("wizard.profileBody", { status: statusLabel, name: anchorName }) : t("wizard.pickBody", { status: statusLabel, name: anchorName })}</p>
        </div>
        <div className={styles.readout}><span>{t("wizard.statusReadout")}</span><strong>{statusLabel}</strong></div>
        {info?.direction === "partner" && <DatePicker label={t("wizard.marriedOn")} value={marriedOn} defaultYear={2000} onChange={setMarriedOn} />}
        {mode === "new" ? <>
          <PhotoPicker person={person} gender={impliedGender} size={68} layout="row" onChange={patch => setPerson({ ...person, ...patch })} />
          <NameField person={person} onChange={setPerson} big autoFocus />
          <details className={styles.details}>
            <summary>{t("form.more")}<Plus size={16} aria-hidden="true" /></summary>
            <div><BirthDateField person={person} onChange={setPerson} optional /><ResidenceField person={person} onChange={setPerson} /></div>
          </details>
          {coParents.length > 0 && <fieldset className={styles.fieldset}>
            <legend>{t("wizard.coParent")}</legend>
            <label className={styles.option}><input type="radio" name="co-parent" checked={coParentId === null} onChange={() => setCoParentId(null)} /><span><strong>{t("wizard.noCoParent")}</strong></span></label>
            {coParents.map(partner => <label key={partner.id} className={styles.option}><input type="radio" name="co-parent" checked={coParentId === partner.id} onChange={() => setCoParentId(partner.id)} /><Avatar person={partner} gender={partner.gender} size={44} /><span><strong>{displayName(partner)}</strong><small>{t(`gender.${partner.gender}`)}</small></span></label>)}
          </fieldset>}
        </> : <fieldset className={styles.fieldset}>
          <legend>{t("relEdit.member")}</legend>
          {candidates.map(candidate => <label key={candidate.id} className={styles.option}><input type="radio" name="existing" checked={existingId === candidate.id} onChange={() => setExistingId(candidate.id)} /><Avatar person={candidate} gender={candidate.gender} size={44} /><span><strong>{displayName(candidate)}</strong><small>{t(`gender.${candidate.gender}`)}</small></span></label>)}
        </fieldset>}
        {error && <p className={styles.note} role="alert">{error}</p>}
      </form>}
    </Dialog>
    {confirm}
  </>;
}
