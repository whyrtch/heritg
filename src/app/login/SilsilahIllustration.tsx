import React from "react";

// Five generations, sized like the Keluarga Joko Widodo demo: 4 / 2 / 2 / 6 / 6 people.
const ROWS = [4, 2, 2, 6, 6];
// [level, partnerA, partnerB, childLevel, childIndexes]
const COUPLES: [number, number, number, number, number[]][] = [[0, 0, 1, 1, [0]], [0, 2, 3, 1, [1]], [1, 0, 1, 2, [0]], [2, 0, 1, 3, [0, 2, 4]], [3, 0, 1, 4, [0, 1]], [3, 2, 3, 4, [2, 3, 4]], [3, 4, 5, 4, [5]]];
// The one lineage drawn in soga: highlighted person index per generation.
const LINEAGE = [0, 0, 0, 2, 2];
const PRESETS = { panel: { w: 720, h: 900, s: 112, gap: 128, top: 170 }, band: { w: 768, h: 380, s: 92, gap: 64, top: 84 }, compact: { w: 390, h: 220, s: 54, gap: 34, top: 64 } };
const SOGA = "#d49a66", TARUM = "#2b3a67";

/** Decorative silsilah (family-tree) drawing for the login screen. Contains no real family data. */
export function SilsilahIllustration({ variant, className }: { variant: keyof typeof PRESETS; className?: string }) {
  const { w, h, s, gap, top } = PRESETS[variant];
  const pts = ROWS.map((n, l) => Array.from({ length: n }, (_, i) => ({ x: w / 2 + (i - (n - 1) / 2) * s, y: top + l * gap })));
  const muted: string[] = [], lineage: string[] = [];
  for (const [l, a, b, cl, kids] of COUPLES) {
    const A = pts[l][a], B = pts[l][b], mx = (A.x + B.x) / 2;
    muted.push(`M ${A.x} ${A.y} L ${B.x} ${B.y}`);
    for (const k of kids) {
      const C = pts[cl][k], mid = (A.y + C.y) / 2, r = 10, d = C.x > mx ? 1 : -1;
      const path = Math.abs(C.x - mx) < 1 ? `M ${mx} ${A.y} V ${C.y}` : `M ${mx} ${A.y} V ${mid - r} Q ${mx} ${mid} ${mx + d * r} ${mid} H ${C.x - d * r} Q ${C.x} ${mid} ${C.x} ${mid + r} V ${C.y}`;
      ((LINEAGE[l] === a || LINEAGE[l] === b) && LINEAGE[cl] === k ? lineage : muted).push(path);
    }
  }
  return <svg className={className} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
    {muted.map(d => <path key={d} d={d} fill="none" stroke="#fff" strokeOpacity=".26" strokeWidth="1.5" />)}
    {lineage.map(d => <path key={d} d={d} fill="none" stroke={SOGA} strokeWidth="2.5" strokeLinecap="round" />)}
    {pts.flatMap((row, l) => row.map((p, i) => {
      const on = LINEAGE[l] === i, last = on && l === ROWS.length - 1;
      return <g key={`${l}-${i}`}>
        {last && <circle cx={p.x} cy={p.y} r={s * 0.2 + 8} fill="none" stroke={SOGA} strokeOpacity=".55" strokeWidth="1.5" />}
        <circle cx={p.x} cy={p.y} r={Math.max(6, Math.round(s * (on ? 0.12 : 0.09)))} fill={on ? SOGA : TARUM} stroke={on ? SOGA : "#fff"} strokeOpacity={on ? 1 : 0.5} strokeWidth="1.5" />
      </g>;
    }))}
  </svg>;
}
