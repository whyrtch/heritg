"use client";

import React from "react";
import { ArrowDown, ArrowUp, Heart } from "lucide-react";
import { useT } from "@/i18n";
import { BIRTH_ORDER_MAX, NAME_MAX, RESIDENCE_MAX, type Person } from "../model";
import { RELATIONSHIP_STATUSES, STATUS_GROUPS, type RelationshipStatusKey } from "../domain/relationshipStatus";
import { DatePicker } from "./DatePicker";
import styles from "./dialogs.module.css";

type FieldProps = { person: Person; onChange: (person: Person) => void };

export function NameField({ person, onChange, big = false, autoFocus = false }: FieldProps & { big?: boolean; autoFocus?: boolean }) {
  const t = useT();
  return <label className={`${styles.field} ${big ? styles.bigName : ""}`}>{t("form.name")}
    <input autoFocus={autoFocus} required autoComplete="name" maxLength={NAME_MAX} value={person.name} onChange={event => onChange({ ...person, name: event.target.value })} />
  </label>;
}

export function GenderField({ person, onChange }: FieldProps) {
  const t = useT();
  return <label className={styles.field}>{t("form.gender")}
    <select value={person.gender} onChange={event => onChange({ ...person, gender: event.target.value as Person["gender"] })}>
      <option value="unspecified">{t("gender.unspecified")}</option><option value="female">{t("gender.female")}</option><option value="male">{t("gender.male")}</option>
    </select>
  </label>;
}

export function ResidenceField({ person, onChange }: FieldProps) {
  const t = useT();
  return <label className={styles.field}>{t("form.residence")}
    <input autoComplete="address-level2" maxLength={RESIDENCE_MAX} value={person.residence} onChange={event => onChange({ ...person, residence: event.target.value })} />
  </label>;
}

export function BirthOrderField({ person, onChange }: FieldProps) {
  const t = useT();
  return <label className={styles.field}>{t("form.birthOrder")}
    <input type="number" min={1} max={BIRTH_ORDER_MAX} step={1} inputMode="numeric" value={person.birthOrder ?? ""} onChange={event => onChange({ ...person, birthOrder: event.target.value ? Math.max(1, Math.min(BIRTH_ORDER_MAX, Math.round(Number(event.target.value)))) : null })} />
    <small>{t("form.birthOrderHint")}</small>
  </label>;
}

export function BirthDateField({ person, onChange, optional = false }: FieldProps & { optional?: boolean }) {
  const t = useT();
  return <DatePicker label={t(optional ? "form.birthDateOptional" : "form.birthDate")} value={person.birthDate} defaultYear={1990} onChange={birthDate => onChange({ ...person, birthDate })} />;
}

export function DeathDateField({ person, onChange }: FieldProps) {
  const t = useT();
  return <DatePicker label={t("form.deathDate")} value={person.deathDate} onChange={deathDate => onChange({ ...person, deathDate })} />;
}

const directionIcon = { parent: ArrowUp, child: ArrowDown, partner: Heart } as const;

/** The grouped relationship statuses of heritg.us step 2 (Paling sering, Orang tua & Wali, …). */
export function StatusPicker({ value, onPick }: { value?: RelationshipStatusKey | null; onPick: (key: RelationshipStatusKey) => void }) {
  const t = useT();
  return <>{STATUS_GROUPS.map(group => <section key={group} className={styles.group} role="group" aria-label={t(`relGroup.${group}`)}>
    <h4>{t(`relGroup.${group}`)}</h4>
    <div className={styles.statusGrid}>
      {RELATIONSHIP_STATUSES.filter(status => status.group === group).map(status => {
        const Icon = directionIcon[status.direction];
        return <button key={status.key} type="button" className={styles.status} aria-pressed={value === status.key} onClick={() => onPick(status.key)}><span><Icon size={15} aria-hidden="true" /></span>{t(`rel.${status.key}`)}</button>;
      })}
    </div>
  </section>)}</>;
}
