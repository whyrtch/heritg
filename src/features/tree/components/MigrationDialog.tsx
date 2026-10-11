"use client";

import React, { useMemo, useState } from "react";
import type { MigrationPlan, MigrationProgress, MigrationRunResult } from "../migration/types";

export function MigrationDialog({ plan, progress, result, busy = false, onMigrate, onPostpone }: {
  plan: MigrationPlan;
  progress?: MigrationProgress | null;
  result?: MigrationRunResult | null;
  busy?: boolean;
  onMigrate: (treeIds: string[]) => void | Promise<void>;
  onPostpone: () => void;
}) {
  const available = useMemo(() => plan.items.filter(item => !item.alreadyCompleted && item.validationErrors.length === 0), [plan.items]);
  const [selected, setSelected] = useState(() => new Set(available.map(item => item.localTreeId)));
  const failedIds = new Set(result?.failed.map(item => item.localTreeId) ?? []);

  return <div role="presentation" style={backdrop}>
    <section role="dialog" aria-modal="true" aria-labelledby="migration-title" style={dialog}>
      <h2 id="migration-title" style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 700, letterSpacing: "-.01em" }}>Import family trees</h2>
      <p style={muted}>Choose which trees to copy securely to your owner account. Your original browser data will remain untouched.</p>
      <div aria-label="Migration summary" style={summary}><strong>{plan.totals.treeCount} trees</strong><span>{plan.totals.personCount} people</span><span>{plan.totals.estimatedWrites} estimated writes</span></div>
      {plan.totals.excludedPhotoCount > 0 && <p role="status" style={warning}>{plan.totals.excludedPhotoCount} embedded {plan.totals.excludedPhotoCount === 1 ? "photo" : "photos"} cannot be uploaded. Names and other details will still migrate.</p>}
      <div style={list}>{plan.items.map(item => <label key={item.localTreeId} style={treeRow}>
        <input type="checkbox" style={checkbox} disabled={busy || item.alreadyCompleted || item.validationErrors.length > 0} checked={item.alreadyCompleted || selected.has(item.localTreeId)} onChange={event => setSelected(current => { const next = new Set(current); if (event.target.checked) next.add(item.localTreeId); else next.delete(item.localTreeId); return next; })} />
        <span><strong>{item.name}</strong><small style={small}>{item.personCount} people, {item.relationshipCount} relationships{item.alreadyCompleted ? ". Already imported" : ""}</small>{item.validationErrors.map(error => <small key={error} role="alert" style={errorText}>{error}</small>)}{failedIds.has(item.localTreeId) && <small role="alert" style={errorText}>Could not import. It is safe to retry.</small>}</span>
      </label>)}</div>
      <div aria-live="polite" style={{ minHeight: 22 }}>{progress && <span>{progress.status === "failed" ? progress.error : `${progress.status} ${progress.completed} of ${progress.total}`}</span>}</div>
      <div style={actions}><button type="button" disabled={busy} onClick={onPostpone} style={secondary}>Postpone</button><button type="button" disabled={busy || selected.size === 0} onClick={() => void onMigrate([...selected])} style={primary}>{result?.failed.length ? "Retry migration" : busy ? "Migrating…" : "Migrate selected"}</button></div>
    </section>
  </div>;
}

const backdrop: React.CSSProperties = { position: "fixed", inset: 0, zIndex: 100, display: "grid", placeItems: "center", padding: 20, background: "rgba(28,35,64,.4)" };
const dialog: React.CSSProperties = { width: "min(100%, 560px)", maxHeight: "min(760px, 92vh)", overflow: "auto", padding: 30, borderRadius: 22, background: "var(--surface)", boxShadow: "var(--shadow-modal)" };
const muted: React.CSSProperties = { color: "var(--muted)", lineHeight: 1.5 };
const summary: React.CSSProperties = { display: "flex", flexWrap: "wrap", gap: 14, padding: 14, borderRadius: 12, background: "var(--info)", fontSize: 13 };
const warning: React.CSSProperties = { padding: 12, border: "1px solid #dfc28d", borderRadius: 10, color: "#785a20", background: "var(--warning)", fontSize: 13 };
const list: React.CSSProperties = { display: "grid", gap: 8, margin: "18px 0" };
const treeRow: React.CSSProperties = { display: "grid", gridTemplateColumns: "20px 1fr", gap: 10, padding: 12, border: "1px solid var(--line)", borderRadius: 10 };
const checkbox: React.CSSProperties = { accentColor: "var(--primary)" };
const small: React.CSSProperties = { display: "block", marginTop: 4, color: "var(--muted)" };
const errorText: React.CSSProperties = { display: "block", marginTop: 4, color: "var(--danger)" };
const actions: React.CSSProperties = { display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 12 };
const secondary: React.CSSProperties = { border: "1px solid var(--line)", borderRadius: 10, padding: "11px 16px", background: "transparent", cursor: "pointer" };
const primary: React.CSSProperties = { border: 0, borderRadius: 10, padding: "11px 16px", background: "var(--primary)", color: "white", fontWeight: 700, cursor: "pointer" };
