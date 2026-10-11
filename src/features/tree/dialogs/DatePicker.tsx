"use client";

import React, { useEffect, useId, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useT } from "@/i18n";
import styles from "./dialogs.module.css";

const pad = (value: number) => String(value).padStart(2, "0");
const iso = (year: number, month: number, day: number) => `${year}-${pad(month + 1)}-${pad(day)}`;
const todayIso = () => { const now = new Date(); return iso(now.getFullYear(), now.getMonth(), now.getDate()); };
const FIRST_YEAR = 1800;

/** "21 Juni 1961" in the current language; "" for an empty value. */
export function formatDate(value: string, months: string[]): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? `${Number(match[3])} ${months[Number(match[2]) - 1]} ${match[1]}` : "";
}

/** Days shown for a month, Monday first, always six weeks so the popover never jumps in height. */
export function monthGrid(year: number, month: number): { year: number; month: number; day: number; outside: boolean }[] {
  const first = new Date(Date.UTC(year, month, 1));
  const offset = (first.getUTCDay() + 6) % 7;
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(Date.UTC(year, month, 1 - offset + index));
    return { year: date.getUTCFullYear(), month: date.getUTCMonth(), day: date.getUTCDate(), outside: date.getUTCMonth() !== month };
  });
}

/**
 * Button-style date field (heritg.us): shows "Pilih tanggal" or the formatted date, and opens a calendar
 * popover with month/year selects, previous/next month, "Hapus tanggal" and "Hari ini". Value is YYYY-MM-DD.
 */
export function DatePicker({ label, value, onChange, defaultYear }: { label: string; value: string; onChange: (value: string) => void; defaultYear?: number }) {
  const t = useT();
  const labelId = useId();
  const months = t("date.months").split(",");
  const weekdays = t("date.weekdays").split(",");
  const [open, setOpen] = useState(false);
  const now = new Date();
  const initial = /^(\d{4})-(\d{2})/.exec(value);
  const [view, setView] = useState(() => initial ? { year: Number(initial[1]), month: Number(initial[2]) - 1 } : { year: defaultYear ?? now.getFullYear(), month: defaultYear ? 0 : now.getMonth() });
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const today = todayIso();

  useEffect(() => {
    if (!open) return;
    const outside = (event: MouseEvent) => { if (!wrap.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", outside);
    wrap.current?.querySelector<HTMLElement>("[aria-pressed=true], .todayMark, select")?.focus();
    return () => document.removeEventListener("mousedown", outside);
  }, [open]);

  const close = () => { setOpen(false); button.current?.focus(); };
  const pick = (next: string) => { onChange(next); close(); };
  const shift = (delta: number) => setView(current => { const month = current.month + delta; return { year: current.year + Math.floor(month / 12), month: ((month % 12) + 12) % 12 }; });
  const years = Array.from({ length: now.getFullYear() - FIRST_YEAR + 1 }, (_, index) => now.getFullYear() - index);

  return <div className={styles.field}>
    <span id={labelId}>{label}</span>
    <div ref={wrap} className={styles.dateWrap}>
      <button ref={button} type="button" className={`${styles.dateButton} ${value ? styles.hasValue : ""}`} aria-haspopup="dialog" aria-expanded={open} aria-labelledby={`${labelId} ${labelId}-value`} onClick={() => setOpen(value => !value)}>
        <CalendarDays size={17} aria-hidden="true" /><span id={`${labelId}-value`}>{value ? formatDate(value, months) : t("date.pick")}</span>
      </button>
      {open && <div className={styles.datePop} role="dialog" aria-labelledby={labelId} data-nested-popup onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); close(); } }}>
        <div className={styles.dateNav}>
          <select aria-label={t("date.month")} value={view.month} onChange={event => setView({ ...view, month: Number(event.target.value) })}>{months.map((name, index) => <option key={name} value={index}>{name}</option>)}</select>
          <select aria-label={t("date.year")} value={view.year} onChange={event => setView({ ...view, year: Number(event.target.value) })}>{years.map(year => <option key={year} value={year}>{year}</option>)}</select>
          <span className={styles.spacer} />
          <button type="button" aria-label={t("date.prev")} onClick={() => shift(-1)}><ChevronLeft size={18} aria-hidden="true" /></button>
          <button type="button" aria-label={t("date.next")} onClick={() => shift(1)}><ChevronRight size={18} aria-hidden="true" /></button>
        </div>
        <div className={styles.weekdays} aria-hidden="true">{weekdays.map(day => <span key={day}>{day}</span>)}</div>
        <div className={styles.days}>
          {monthGrid(view.year, view.month).map(cell => {
            const date = iso(cell.year, cell.month, cell.day);
            return <button key={date} type="button" className={`${cell.outside ? styles.outside : ""} ${date === today ? `${styles.today} todayMark` : ""}`} aria-label={formatDate(date, months)} aria-pressed={date === value} onClick={() => pick(date)}>{cell.day}</button>;
          })}
        </div>
        <div className={styles.dateFoot}>
          <button type="button" disabled={!value} onClick={() => pick("")}>{t("date.clear")}</button>
          <button type="button" className={styles.todayButton} onClick={() => pick(today)}>{t("date.today")}</button>
        </div>
      </div>}
    </div>
  </div>;
}
