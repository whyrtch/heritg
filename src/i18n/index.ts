"use client";

import { useSyncExternalStore } from "react";
import { id, type Messages } from "./id";
import { en } from "./en";
import { ms } from "./ms";

export type Language = "id" | "en" | "ms";
export type MessageKey = keyof Messages;

const catalogs: Record<Language, Partial<Messages>> = { id, en, ms };
const STORAGE_KEY = "heritg.language";
const listeners = new Set<() => void>();
let current: Language = "id";

function readStored(): Language {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value === "en" || value === "ms" || value === "id" ? value : "id";
  } catch {
    return "id";
  }
}

if (typeof window !== "undefined") current = readStored();

export function getLanguage(): Language {
  return current;
}

export function setLanguage(language: Language): void {
  current = language;
  try { window.localStorage.setItem(STORAGE_KEY, language); } catch { /* storage may be unavailable */ }
  listeners.forEach(listener => listener());
}

/** Translate a key, falling back to Indonesian, then to the key itself. `{name}` placeholders are filled from `vars`. */
export function translate(language: Language, key: MessageKey, vars: Record<string, string | number> = {}): string {
  const template = catalogs[language][key] ?? id[key] ?? key;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match));
}

export function t(key: MessageKey, vars?: Record<string, string | number>): string {
  return translate(current, key, vars);
}

/** React hook: re-renders when the app language changes. */
export function useT() {
  const language = useSyncExternalStore(
    listener => { listeners.add(listener); return () => listeners.delete(listener); },
    () => current,
    () => "id" as Language,
  );
  return (key: MessageKey, vars?: Record<string, string | number>) => translate(language, key, vars);
}
