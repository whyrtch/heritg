"use client";

import React, { useId, useState } from "react";
import { Check, Circle, Eye, EyeOff } from "lucide-react";
import { useT, type MessageKey } from "@/i18n";
import { checkPassword } from "../domain/passwordRules";
import styles from "./panels.module.css";

const RULES = [
  ["length8", "pw.length8"], ["lower", "pw.lower"], ["upper", "pw.upper"], ["digit", "pw.digit"], ["symbol", "pw.symbol"],
] as const satisfies readonly (readonly [keyof ReturnType<typeof checkPassword>, MessageKey])[];

type Props = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Shows the live requirements checklist (used when choosing a new password). */
  checklist?: boolean;
  hint?: string;
  autoComplete?: "new-password" | "current-password";
  autoFocus?: boolean;
  invalid?: boolean;
};

/** A password input with a show/hide toggle and an optional live checklist of the password rules. */
export function PasswordField({ label, value, onChange, checklist, hint, autoComplete = "new-password", autoFocus, invalid }: Props) {
  const t = useT();
  const id = useId();
  const [shown, setShown] = useState(false);
  const checks = checkPassword(value);
  return <div className={styles.passwordField}>
    <label htmlFor={id}>{label}</label>
    <div className={styles.passwordInput}>
      <input id={id} type={shown ? "text" : "password"} value={value} autoComplete={autoComplete} autoFocus={autoFocus} aria-invalid={invalid || undefined} spellCheck={false} onChange={event => onChange(event.target.value)} />
      <button type="button" aria-label={shown ? t("pw.hide") : t("pw.show")} aria-pressed={shown} onClick={() => setShown(value => !value)}>
        {shown ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
      </button>
    </div>
    {hint && <small>{hint}</small>}
    {checklist && value && <ul className={styles.passwordRules} aria-label={t("pw.rules")}>
      {RULES.map(([key, message]) => <li key={key} data-met={checks[key]}>
        {checks[key] ? <Check size={14} aria-hidden="true" /> : <Circle size={14} aria-hidden="true" />}
        <span>{t(message)}</span><span className={styles.srOnly}>{checks[key] ? t("pw.met") : t("pw.unmet")}</span>
      </li>)}
    </ul>}
  </div>;
}
