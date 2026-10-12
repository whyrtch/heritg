"use client";

import { useSyncExternalStore } from "react";
import type { KinshipDialect } from "./kinship";
import { KINSHIP_DIALECTS } from "./kinshipTerms";

const STORAGE_KEY = "heritg.kinshipDialect";
const listeners = new Set<() => void>();
let current: KinshipDialect = "id";

function readStored(): KinshipDialect {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return KINSHIP_DIALECTS.find(dialect => dialect === value) ?? "id";
  } catch {
    return "id";
  }
}

if (typeof window !== "undefined") current = readStored();

export function getDialect(): KinshipDialect {
  return current;
}

export function setDialect(dialect: KinshipDialect): void {
  current = dialect;
  try { window.localStorage.setItem(STORAGE_KEY, dialect); } catch { /* storage may be unavailable */ }
  listeners.forEach(listener => listener());
}

/** React hook: the chosen kinship-term dialect, re-rendering on change. */
export function useDialect(): KinshipDialect {
  return useSyncExternalStore(
    listener => { listeners.add(listener); return () => listeners.delete(listener); },
    () => current,
    () => "id" as KinshipDialect,
  );
}
