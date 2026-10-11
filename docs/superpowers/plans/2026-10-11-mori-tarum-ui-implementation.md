# Heritg "Mori & Tarum" UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Also load `.agents/skills/frontend-design/SKILL.md` before touching CSS.

**Goal:** Ship the redesigned Heritg UI from Figma into the Next.js app: new tokens and typeface, readable person cards, rounded connectors, consolidated canvas chrome, a new login, restyled dialogs and public page, and plain-language copy. No behavior changes.

**Architecture:** Presentation-only change. Tokens live in `src/app/globals.css` as CSS custom properties; CSS modules and the few inline-styled dialogs consume them. Three pure helpers move into `src/features/tree/model.ts` and get unit tests: `lifespanLabel`, `generationCount`, `connectorPath`. `Workspace.tsx` and `PublicTree.tsx` share the helpers instead of duplicating path logic.

**Tech Stack:** Next.js 15, React 19, TypeScript, CSS Modules, `next/font/google`, `lucide-react`, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-11-mori-tarum-visual-redesign-design.md`
**Design QA plan (Figma, blocked on MCP quota):** `docs/superpowers/plans/2026-10-11-mori-tarum-visual-redesign.md`, Tasks 1–2
**Figma:** https://www.figma.com/design/h7ZwKUiWepibq9xA1pLNIK (Foundations page; Screens page `2:214`, columns Desktop x=0 / Tablet x=1540 / Mobile x=2408)

## Global Constraints

- Do not change Firebase, Rules, sync, migration, publishing, or routing logic.
- Keep the 210×108 person-card slot and the `layoutTree()` spacing (250 × 190). Connector anchors depend on them.
- Keep the accessible names that tests rely on: "Email address", "Password", "Sign in", "Forgot your password?", "Send reset link", "Publish with link", "Copy link", "Update public version", "Regenerate link", "Unpublish", "Postpone", "Retry migration", "Replace online with my version", "Confirm replacing online version", "This family tree is unavailable", "Retry".
- The public page must contain no buttons and no text matching `/edit/i` (`PublicTree.test.tsx`).
- Breakpoints stay as today: `767px` (workspace), `700px` (public header), `520px` (login and photo row).
- Soga appears at most once per screen outside the login illustration.
- Every task ends with `npm test -- --run` and `npm run lint` passing, then one commit.
- Accessibility floor: visible focus ring on every control, `prefers-reduced-motion` respected, WCAG AA text contrast.

---

## File Map

- `src/app/globals.css`: tokens, font variables, focus ring.
- `src/app/layout.tsx`: Plus Jakarta Sans via `next/font/google`.
- `src/features/tree/model.ts`, `model.test.ts`: `lifespanLabel`, `lifeDatesLong`, `generationCount`, `connectorPath`, card constants.
- `src/features/tree/Workspace.tsx`, `workspace.module.css`: cards, connectors, chrome, sidebar, panel, settings, copy.
- `src/app/page.tsx`, `src/features/auth/OwnerSession.tsx`, `auth.module.css`: Sign out moves into Settings.
- `src/app/login/page.tsx`, `login.module.css`, new `src/app/login/SilsilahIllustration.tsx` (+ test).
- `src/app/tree/[publicId]/PublicTree.tsx`, `publicTree.module.css`: shared card/connector, header, footer, status page.
- `src/features/tree/components/PublishDialog.tsx`, `MigrationDialog.tsx`, `SyncStatus.tsx`: tokens and copy.

---

### Task 1: Tokens and typeface

**Files:** Modify `src/app/globals.css`, `src/app/layout.tsx`

- [x] **Step 1: Replace the `:root` block in `globals.css`.** The old names stay as aliases, so every existing `var(--plum)` / `var(--brand)` keeps working and picks up the new color:

```css
:root{
  --canvas:#eef0eb;--surface:#ffffff;--panel:#f7f8f5;--sidebar:#f3f5f1;--input:#ffffff;
  --avatar:#dfe5f0;--info:#e9edf4;--key:#e3e8f2;
  --ink:#1c2340;--muted:#5c6478;--initials:#2b3a67;--danger:#a23b3b;
  --line:#d6dbd3;--card-line:#cdd3cb;--connector:#a3abbe;
  --primary:#2b3a67;--primary-soft:#e3e8f2;--soga:#9a5b2e;--soga-strong:#8a4f26;--green:#3f7a5a;--warning:#f6ebd3;
  --backdrop:rgba(28,35,64,.45);
  --shadow-soft:0 1px 2px rgba(28,35,64,.05),0 4px 12px rgba(28,35,64,.06);
  --shadow-selected:0 0 0 4px rgba(43,58,103,.16),0 6px 18px rgba(28,35,64,.12);
  --shadow-panel:-12px 0 32px rgba(28,35,64,.10);
  --shadow-modal:0 24px 60px rgba(28,35,64,.22);
  --shadow:var(--shadow-soft);
  /* legacy aliases — remove once no module references them */
  --plum:var(--primary);--brand:var(--soga);
  --font-sans:var(--font-jakarta),"Segoe UI",system-ui,sans-serif;
  --font-serif:var(--font-sans);
}
```

- [x] **Step 2: Update the focus ring.** `outline:3px solid rgba(43,58,103,.32)`.
- [x] **Step 3: Load the font in `layout.tsx`.** Also update `metadata.description`, which still says "privately on this device":

```tsx
import { Plus_Jakarta_Sans } from "next/font/google";
const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], weight: ["400", "500", "700", "800"], variable: "--font-jakarta", display: "swap" });
// …
return <html lang="en" className={jakarta.variable}><body><AuthProvider>{children}</AuthProvider></body></html>;
```

```ts
description: "Keep your family tree private, and share it by link when you choose.",
```

- [x] **Step 4: Verify.** `npm run build` succeeds; this needs network access to Google Fonts at build time. If the build machine is offline, switch to `@fontsource/plus-jakarta-sans` and import its CSS in `layout.tsx` instead.
- [x] **Step 5: Commit** `style: adopt Mori & Tarum tokens and Plus Jakarta Sans`.

### Task 2: Model helpers for cards, generations and connectors (TDD)

**Files:** Modify `src/features/tree/model.ts`, `src/features/tree/model.test.ts`

- [x] **Step 1: Add the failing tests first.**

```ts
import { connectorPath, generationCount, lifeDatesLong, lifespanLabel } from "./model";

describe("display helpers", () => {
  const p = (birthDate = "", deathDate = "") => ({ ...emptyPerson(), birthDate, deathDate });
  it("labels lifespans by year", () => {
    expect(lifespanLabel(p("1961-06-21"))).toBe("Born 1961");
    expect(lifespanLabel(p("1940-12-30", "2000-07-23"))).toBe("1940 – 2000");
    expect(lifespanLabel(p("", "2015-10-23"))).toBe("Died 2015");
    expect(lifespanLabel(p())).toBe("Years unknown");
  });
  it("writes long dates without timezone drift", () => {
    expect(lifeDatesLong(p("1961-06-21"))).toBe("Born 21 June 1961");
    expect(lifeDatesLong(p("1940-12-30", "2000-07-23"))).toBe("Born 30 December 1940 · Died 23 July 2000");
    expect(lifeDatesLong(p())).toBe("Birth date unknown");
  });
  it("counts generations from the layout", () => {
    expect(generationCount(createJokowiDemoTree())).toBe(5);
    expect(generationCount(newTree())).toBe(0);
  });
  it("draws straight and rounded-elbow connectors", () => {
    const a = { id: "a", x: 0, y: 0 }, b = { id: "b", x: 0, y: 190 }, c = { id: "c", x: 250, y: 190 }, d = { id: "d", x: -250, y: 190 };
    expect(connectorPath(a, b, "parent-child")).toBe("M 105 108 V 190");
    expect(connectorPath(a, c, "parent-child")).toBe("M 105 108 V 137 Q 105 149 117 149 H 343 Q 355 149 355 161 V 190");
    expect(connectorPath(a, d, "parent-child")).toContain("Q 105 149 93 149");
    expect(connectorPath(c, b, "partner")).toBe("M 210 244 L 250 244");
  });
});
```

- [x] **Step 2: Implement.** Constants are shared with the CSS card size.

```ts
export const CARD_W = 210, CARD_H = 108;

const year = (iso: string) => iso.slice(0, 4);
export function lifespanLabel(person: Person): string {
  const born = year(person.birthDate), died = year(person.deathDate);
  if (born && died) return `${born} – ${died}`;
  if (born) return `Born ${born}`;
  if (died) return `Died ${died}`;
  return "Years unknown";
}

const longDate = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const fmt = (iso: string) => longDate.format(new Date(`${iso}T00:00:00Z`));
export function lifeDatesLong(person: Person): string {
  const parts = [person.birthDate && `Born ${fmt(person.birthDate)}`, person.deathDate && `Died ${fmt(person.deathDate)}`].filter(Boolean);
  return parts.length ? parts.join(" · ") : "Birth date unknown";
}

export function generationCount(tree: FamilyTree): number {
  return new Set(layoutTree(tree).map(node => node.y)).size;
}

export function connectorPath(from: NodeLayout, to: NodeLayout, type: Relationship["type"], radius = 12): string {
  if (type === "partner") {
    const [left, right] = from.x <= to.x ? [from, to] : [to, from];
    return `M ${left.x + CARD_W} ${left.y + CARD_H / 2} L ${right.x} ${right.y + CARD_H / 2}`;
  }
  const x1 = from.x + CARD_W / 2, top = from.y + CARD_H, x2 = to.x + CARD_W / 2, bottom = to.y;
  if (Math.abs(x1 - x2) < 1) return `M ${x1} ${top} V ${bottom}`;
  const mid = (top + bottom) / 2, s = x2 > x1 ? 1 : -1;
  const r = Math.min(radius, Math.abs(x2 - x1) / 2, (bottom - top) / 2);
  return `M ${x1} ${top} V ${mid - r} Q ${x1} ${mid} ${x1 + s * r} ${mid} H ${x2 - s * r} Q ${x2} ${mid} ${x2} ${mid + r} V ${bottom}`;
}
```

The `·` in `lifeDatesLong` is the only middle dot left in the UI. It separates two dates, not a meta list. Replace it with a line break in the panel if a reviewer prefers.

- [x] **Step 3:** `npm test -- --run src/features/tree/model.test.ts` passes.
- [x] **Step 4: Commit** `feat: add lifespan, generation and connector helpers`.

### Task 3: Person cards and connectors on the workspace canvas

**Files:** Modify `src/features/tree/Workspace.tsx`, `workspace.module.css`

- [x] **Step 1: Connectors.** Replace the inline `d` computation in the `<svg className={styles.lines}>` map with `connectorPath(from, to, rel.type)`.
- [x] **Step 2: Card markup.** Remove `<MoreHorizontal size={17} />` and its import, and swap the dates line for `lifespanLabel`:

```tsx
<span className={styles.personText}>
  <strong>{displayName(person)}</strong>
  <small>{privacy ? "Private" : lifespanLabel(person)}</small>
</span>
```

- [x] **Step 3: CSS.** Replace the `.personCard`, `.avatar`, `.personText`, and `.lines path` rules:

```css
.personCard{position:absolute;width:210px;height:108px;border:1px solid var(--card-line);border-radius:14px;background:var(--surface);box-shadow:var(--shadow-soft);display:flex;align-items:center;gap:12px;padding:12px 12px 12px 14px;text-align:left;cursor:pointer;transition:box-shadow .18s,border-color .18s}
.personCard:hover{box-shadow:0 2px 4px rgba(28,35,64,.06),0 10px 24px rgba(28,35,64,.10)}
.personCard.selected{border:2px solid var(--primary);padding:11px 11px 11px 13px;box-shadow:var(--shadow-selected)}
.avatar{width:44px;height:44px;font-size:17px;flex:0 0 auto}
.selected .avatar{background:var(--primary);color:#fff}
.personText strong{font-size:15px;line-height:19px;font-weight:700;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;white-space:normal}
.personText small{font-size:12px;color:var(--muted);margin-top:4px}
.lines path{fill:none;stroke:var(--connector);stroke-width:1.5;stroke-linecap:round}
```

  Drop the hover `translateY(-2px)`: the skill asks for restraint in hover motion on every card. In the shared `.avatar,.smallAvatar` rule, set `background:var(--avatar);color:var(--initials);font-family:var(--font-sans)`.
- [x] **Step 4: Mobile.** Remove the `@media(max-width:767px)` override `.personCard{width:190px}`, because the connector math assumes 210. Mobile already zooms the stage.
- [x] **Step 5: Verify.** `npm run dev`, open the demo tree, and confirm long names wrap to two lines (e.g. "Panembahan Al Nahyan Nasution") and connectors have rounded elbows.
- [x] **Step 6: Commit** `style: readable person cards and rounded connectors`.

### Task 4: Consolidate canvas chrome and move Sign out into Settings

**Files:** Modify `Workspace.tsx`, `workspace.module.css`, `src/app/page.tsx`, `src/features/auth/OwnerSession.tsx`, `src/features/auth/auth.module.css`

- [x] **Step 1: Top bar.**
  - Delete the `familyButton` button from `topActions`. Keep Share and Settings.
  - Replace the tree-title meta with:

```tsx
const generations = generationCount(active);
const summary = active.people.length === 0 ? "No one added yet"
  : `${active.people.length} ${active.people.length === 1 ? "person" : "people"} across ${generations} ${generations === 1 ? "generation" : "generations"}`;
```

- [x] **Step 2: Control capsule.**
  - In `<aside className={styles.rightControls}>`, delete the "Branch depth" `IconButton`: it has no handler, so it does nothing today.
  - Keep "All people", "Zoom in", "Zoom out", and "Fit tree".
  - Give `IconButton` an optional `quiet` flag that adds `styles.quiet` (no border, shadow, or fill), and use it for the four capsule buttons.

```css
.rightControls{position:absolute;right:18px;top:50%;transform:translateY(-50%);z-index:13;display:flex;flex-direction:column;gap:2px;padding:4px;border:1px solid var(--line);border-radius:999px;background:var(--surface);box-shadow:var(--shadow-soft)}
.quiet{border:0;background:transparent;box-shadow:none}
.iconButton{width:42px;height:42px}
```

- [x] **Step 3: Single privacy toggle.**
  - Delete the `bottomLeft` eye button. The bottom-right chip becomes the only toggle:

```tsx
<button className={styles.protected} aria-pressed={privacy} onClick={() => setPrivacy(v => !v)}><ShieldCheck size={18} aria-hidden="true" /> {privacy ? "Dates hidden" : "Dates shown"}</button>
```

  - Remove the now-unused `Eye`, `EyeOff`, and `GitBranch` imports, but only if nothing else uses them.
  - Rename the `.protected` class to `.privacyChip` at the same time.
- [x] **Step 4: Status chips.** Change `Local only` to `Saved on this device only`. In `.syncStatus,.localStatus`, set `border:0; box-shadow:var(--shadow-soft); background:rgba(255,255,255,.92)`.
- [x] **Step 5: Mobile.** Inside `@media(max-width:767px)`:
  - Make `.rightControls` a horizontal capsule at `right:12px; bottom:32px; top:auto; transform:none; flex-direction:row`. Change the `nth-child` hide rule so it hides only "Fit tree", because "Branch depth" no longer exists.
  - Make `.mobileAdd` 52px, `bottom:32px`, `background:var(--primary)`.
  - Delete the `.bottomLeft` and `.bottomRight` hide rules, and hide `.bottomRight` explicitly on mobile, as today.
- [x] **Step 6: Sidebar.**
  - Pass `onFamilyPlus={() => { setSidebar(false); setDeferred("Family+"); }}` into `TreeSidebar` and wire it to the `sidebarFamily` button, which currently has no `onClick`. This keeps the "coming later" explanation reachable now that the top-bar button is gone.
  - Copy changes:
    - `A PRIVATE FAMILY<br />ARCHIVE` → `Your private family archive`
    - `Invite editors in a future release` → `Inviting other editors is coming later`
    - tree meta `{n} people · {date}` → `{n} {person|people}, edited {date}`
  - `.sidebarFamily`: `background:var(--primary-soft); color:var(--ink)`. The small text uses `var(--muted)` at opacity 1, and the icon uses `color:var(--primary)`.
  - Set `.sidebarHead p` to `font-size:12px; letter-spacing:0; text-transform:none`.
- [x] **Step 7: Sign out moves into Settings.** It is currently a fixed-position button at `right:184px` that overlaps the new top bar.
  - Remove `<OwnerSession />` from `src/app/page.tsx`.
  - In the Settings `Panel` in `Workspace.tsx`, after the privacy row, add `<div className={styles.settingRow}><div><strong>Owner account</strong><p>{user?.email}</p></div><OwnerSession /></div>`.
  - In `auth.module.css`, replace `.session`'s fixed positioning with an inline button style: `position:static; height:38px; border-radius:10px`. Remove the 700px media rule.
  - Run `npm test -- --run src/features/auth`. `RequireOwner.test.tsx` does not render `OwnerSession`, so no test update is expected.
- [x] **Step 8: Verify** at 1440, 768, and 390 against Figma rows 02 and 03. Then **commit** `refactor: consolidate canvas controls and move sign out into settings`.

### Task 5: Person panel, editor and remaining workspace surfaces

**Files:** Modify `Workspace.tsx`, `workspace.module.css`

- [x] **Step 1: PersonPanel.**
  - Replace the dates paragraph with `lifeDatesLong(person)`. Below it, if `person.notes` is set, show the notes as a muted 12px line.
  - Change the label `Grow this branch` → `Add a relative`, and remove `text-transform:uppercase` and `letter-spacing` from `.panelLabel`.
  - Give the "Edit details" button a leading `Pencil` icon.
- [x] **Step 2: Hardcoded colors in `workspace.module.css`.** Replace every literal with a token:

| Literal | Token |
|---|---|
| `#765b3d` | `var(--initials)` (avatars), `var(--ink)` (`.brand` text) |
| `#c8ae80`/`#aa8a5d` gradient, `#a78d6544` shadow (`.brandMark`) | `background:var(--soga)`, `box-shadow:none` |
| `#d7c5ad` | `var(--card-line)` |
| `#e8ddce`, `#e5d5c1`, `#e9dfd2` | `var(--avatar)` |
| `#ad9270` | `var(--connector)` |
| `#f8f2e9` | `var(--sidebar)` |
| `#fbf8f2` | `var(--panel)` |
| `#fffaf3`, `#fffdfa` | `var(--input)` |
| `#eee9e1`, `#eee7dd` | `var(--info)` |
| `#eadff0` | `var(--primary-soft)` |
| `#866943` | `var(--soga-strong)` (the "New tree" button: the one soga element on the sidebar) |
| `#9b3f38` | `var(--danger)` |
| `#c7bcb0` | `var(--line)` |
| `#5e584f` | `var(--muted)` |
| `#61407822` | `rgba(43,58,103,.16)` |
| `#49392621`, `#49392612` | `var(--shadow-panel)`, `var(--shadow-soft)` |
| `#382b1b22`, `#27201955` | `rgba(28,35,64,.14)`, `var(--backdrop)` |
| `#33271844` | `var(--shadow-modal)` |
| `rgba(67,51,35,.08)`, `rgba(71,54,37,…)`, `rgba(69,52,36,…)`, `rgba(39,32,25,.48)`, `rgba(51,39,24,.28)` | the matching `--shadow-*` / `--backdrop` |

- [x] **Step 3: Radii.** Modal 20, panel and sidebar no radius, buttons and inputs 10, chips 999.
- [x] **Step 4: Empty state.**
  - `.emptyState h1` at 24px, weight 800, `letter-spacing:-.02em`.
  - Hover row `background:var(--info)`.
  - Drag-hint copy `☝ Drag or scroll to move the canvas` → `Drag or scroll to move the canvas`.
- [x] **Step 5: Conflict card.** Set `.conflictCard` to `background:var(--panel)` and `border-radius:20px`. Restyle `.conflictCard button:nth-of-type(2)` as primary indigo, and the first button as a surface outline. Update `.conflictBackdrop` to `var(--backdrop)`.
- [x] **Step 6: Check.** Run `grep -nE "#[0-9a-fA-F]{3,8}" src/features/tree/workspace.module.css`. The only literals left should be `#fff` / `white`.
- [x] **Step 7: Commit** `style: tokenise workspace surfaces and refresh panel copy`.

### Task 6: Login redesign

**Files:** Create `src/app/login/SilsilahIllustration.tsx`, `src/app/login/SilsilahIllustration.test.tsx`; modify `src/app/login/page.tsx`, `login.module.css`

- [x] **Step 1: Illustration component.** It is decorative, so it uses `aria-hidden`. There are two geometry presets matching Figma frames `16:5291` (panel) and `16:5374` / `16:5454` (band).

```tsx
const ROWS = [4, 2, 2, 6, 6];
// [level, partnerA, partnerB, childLevel, childIndexes]
const COUPLES: [number, number, number, number, number[]][] = [[0,0,1,1,[0]],[0,2,3,1,[1]],[1,0,1,2,[0]],[2,0,1,3,[0,2,4]],[3,0,1,4,[0,1]],[3,2,3,4,[2,3,4]],[3,4,5,4,[5]]];
const LINEAGE = [0, 0, 0, 2, 2]; // highlighted person index per generation
const PRESETS = { panel: { w: 720, h: 900, s: 112, gap: 128, top: 170 }, band: { w: 768, h: 380, s: 92, gap: 64, top: 84 } };

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
    {lineage.map(d => <path key={d} d={d} fill="none" stroke="#d49a66" strokeWidth="2.5" strokeLinecap="round" />)}
    {pts.flatMap((row, l) => row.map((p, i) => {
      const on = LINEAGE[l] === i, last = on && l === ROWS.length - 1;
      return <g key={`${l}-${i}`}>
        {last && <circle cx={p.x} cy={p.y} r={s * 0.2 + 8} fill="none" stroke="#d49a66" strokeOpacity=".55" strokeWidth="1.5" />}
        <circle cx={p.x} cy={p.y} r={Math.max(6, Math.round(s * (on ? 0.12 : 0.09)))} fill={on ? "#d49a66" : "#2b3a67"} stroke={on ? "#d49a66" : "#fff"} strokeOpacity={on ? 1 : 0.5} strokeWidth="1.5" />
      </g>;
    }))}
  </svg>;
}
```

  Test: it renders with `aria-hidden="true"`, draws exactly 4 lineage paths, and has 20 person circles plus 1 ring.
- [x] **Step 2: Page markup.** Behavior and accessible names stay unchanged.
  - Remove the eyebrow and the key circle, and drop the `KeyRound` import.
  - Keep the field label "Email address", because the test uses it (Figma shows "Email" for brevity).

```tsx
return <main className={styles.page}>
  <aside className={styles.story}>
    <div className={styles.brand}><span><Leaf aria-hidden="true" /></span>Heritg</div>
    <SilsilahIllustration variant="panel" className={styles.illustrationPanel} />
    <SilsilahIllustration variant="band" className={styles.illustrationBand} />
    <p className={styles.storyLine}>Keep your family’s story in one place, private until you choose to share it.</p>
  </aside>
  <section className={styles.card} aria-labelledby="login-title">
    <h1 id="login-title">{mode === "login" ? "Welcome back" : "Reset your password"}</h1>
    <p className={styles.lede}>{mode === "login" ? "Sign in with the owner account for this archive." : "Enter your owner email and we’ll send reset instructions."}</p>
    {/* existing config error, form, mode toggle — unchanged */}
    <p className={styles.note}>Only the archive owner has an account. Family members view trees through links the owner shares.</p>
  </section>
</main>;
```

- [x] **Step 3: CSS.**
  - **Desktop (≥ 768px):** `.page{display:grid;grid-template-columns:1fr 1fr;min-height:100%;background:var(--canvas)}`. `.story` is `background:var(--primary);color:#fff;position:relative;overflow:hidden;padding:52px 56px`, with the brand at the top, the panel illustration absolutely filling it, and `.storyLine` at the bottom (22px/28px, weight 700, max-width 460px). `.card` is a 360px column centered in the right half: no card border, no shadow, no radius. `.illustrationBand{display:none}`.
  - **Brand mark:** a 32px soga square with 9px radius and a white `Leaf`. Wordmark 22px weight 800, `letter-spacing:-.02em`.
  - **Headline and inputs:** h1 30px/36px, weight 800, `letter-spacing:-.02em`. Inputs: 10px radius, `var(--line)` border, white background, 12px/14px padding. `.submit`: `var(--primary)`, 10px radius, 46px height. `.mode`: left-aligned, `color:var(--primary)`. `.note`: no border-top, 12px muted.
  - **`@media(max-width:767px)`:** `.page{grid-template-columns:1fr;grid-template-rows:auto 1fr}`. `.story` gets `min-height:380px;padding:32px 40px`. Swap the illustration visibility (`.illustrationPanel{display:none}`, `.illustrationBand{display:block;position:absolute;inset:0;width:100%;height:100%}`) and hide `.storyLine`. `.card` becomes `max-width:400px;margin:0 auto;padding:40px 0`.
  - **`@media(max-width:520px)`:** `.story{min-height:220px;padding:20px 24px}` and `.card{padding:36px 24px}`.
  - Keep the `.error` and `.success` colors, mapped to `var(--danger)` and `var(--green)`.
- [x] **Step 4: Verify.** `npm test -- --run src/app/login` passes unchanged. Visually compare against Figma row 01 at all three widths.
- [x] **Step 5: Commit** `feat: redesign login with silsilah illustration`.

> **As built:** the login stacks the panel above the form below **1024px** (not 768px), matching the Figma tablet frame, and a third `compact` illustration preset (390×220, s=54) is used below 520px so the wordmark does not overlap the first generation.

### Task 7: Dialogs

**Files:** Modify `src/features/tree/components/PublishDialog.tsx`, `MigrationDialog.tsx`, `SyncStatus.tsx`

- [ ] **Step 1: PublishDialog.**
  - Remove the `UNLISTED SHARING` eyebrow `<small>`.
  - Replace the meta line with:

```tsx
<p style={metaStyle}>{tree.publishedRevision !== tree.revision
  ? `The link shows version ${tree.publishedRevision ?? "—"}. Your newest edits aren’t public yet.`
  : `The link shows version ${tree.publishedRevision}.`}</p>
```

  - Restyle the inline style objects with tokens:
    - `dialogStyle`: `background:"var(--panel)", border:"1px solid var(--line)", boxShadow:"var(--shadow-modal)"`.
    - `backdropStyle.background`: `"var(--backdrop)"`.
    - `warningStyle`: `background:"var(--info)", color:"var(--ink)"`.
    - Primary and secondary buttons: `var(--primary)` and `var(--surface)` / `var(--line)`, `borderRadius:10`.
    - `dangerButtonStyle`: `border:"1px solid var(--danger)", color:"var(--danger)"`.
    - Labels and meta: `var(--muted)`.
  - Swap the close `×` for the lucide `X` icon, keeping `aria-label="Close sharing dialog"`.
- [ ] **Step 2: MigrationDialog.**
  - Remove the `MOVE YOUR ARCHIVE ONLINE` eyebrow.
  - Row meta: `{n} people · {m} relationships · Imported` → `{n} people, {m} relationships` when not completed, and `{n} people, {m} relationships. Already imported` when completed.
  - Tokens:
    - `dialog`: `background:"var(--surface)", boxShadow:"var(--shadow-modal)"`.
    - `summary`: `background:"var(--info)"`.
    - `treeRow`: `border:"1px solid var(--line)"`.
    - `primary`: `background:"var(--primary)"`.
    - `secondary`: `border:"1px solid var(--line)"`.
    - `backdrop`: `background:"rgba(28,35,64,.4)"`.
    - `errorText`: `"var(--danger)"`.
  - Keep the amber `warning` colors (warning semantics), but set the background to `var(--warning)`.
  - Add `accentColor:"var(--primary)"` to the checkboxes.
  - Leave the summary text `{personCount} people` as is, because `MigrationDialog.test.tsx` matches `"1 people"`. A pluralization fix is a separate change.
- [ ] **Step 3: SyncStatus.** Labels are unchanged. Add a leading status dot via CSS in `workspace.module.css`: `.syncStatus :global(.syncStatus)::before`, 6px circle in `var(--green)` for saved, `var(--muted)` for saving and loading, `var(--danger)` for conflict, and `var(--soga)` for public-stale and offline.
- [ ] **Step 4:** `npm test -- --run src/features/tree/components` passes. **Commit** `style: restyle sharing, migration and sync status`.

### Task 8: Public read-only page

**Files:** Modify `src/app/tree/[publicId]/PublicTree.tsx`, `publicTree.module.css`

- [ ] **Step 1: Shared helpers.** Use `connectorPath` and `lifespanLabel` (the public page always shows years, because there is no privacy toggle). Keep `person.notes` as the one-line `<em>`.
- [ ] **Step 2: Header copy.**
  - Brand `❈` becomes `<Leaf aria-hidden="true" />` in a soga mark.
  - Badge `UNLISTED` → `Shared by link`, no uppercase or tracking.
  - Meta `Read-only family tree · Published revision {n}` → `View only. Published version {n}`.
- [ ] **Step 3: Footer copy.** `Anyone with this unlisted link can view this archive.` → `You’re viewing a shared copy kept by the archive owner.`. This must not contain "edit".
- [ ] **Step 4: CSS.**
  - Replace every hex value with a token, and every `Georgia,serif` with `var(--font-sans)`.
  - `.personCard` uses the same rules as the workspace card (14px radius, `--card-line`, `--shadow-soft`, 44px avatar, two-line name clamp).
  - Header: `background:rgba(247,248,245,.94)`, border `var(--line)`.
  - Footer: centered, pill radius, no border, `--shadow-soft`.
  - `.status`: `var(--canvas)`. The h1 is 22px, weight 700.
- [ ] **Step 5: StatusPage.** Show a 52px `--key` circle with a lucide `Link` icon above the title, matching Figma `7:3151`, and the soga brand mark.
- [ ] **Step 6:** `npm test -- --run "src/app/tree"` passes: there is still no button and no `/edit/i` text. **Commit** `style: refresh public read-only page`.

### Task 9: Clean-up

- [ ] **Step 1:** Remove the legacy aliases (`--plum`, `--brand`, `--font-serif`) after confirming no references remain:

```bash
grep -rn "var(--plum)\|var(--brand)\|var(--font-serif)" src
```

- [ ] **Step 2:** Remove unused lucide imports flagged by `npm run lint`.
- [ ] **Step 3:** Update `README.md` only if it describes UI elements that changed. It currently does not, so no change is expected.
- [ ] **Step 4: Commit** `chore: remove legacy design aliases`.

### Task 10: Verification

- [ ] `npm test -- --run`, `npm run lint`, `npm run build`.
- [ ] `npm run dev` with `NEXT_PUBLIC_USE_FIREBASE_EMULATORS=true` (or a configured `.env.local`). Then compare each screen against its Figma row at 1440×900, 768×1024, and 390×844:
  - 01 Login
  - 02 Workspace
  - 03 Person panel
  - 04 Add member
  - 05 Share
  - 06 Sidebar
  - 07 Empty tree
  - 08 Conflict
  - 09 Migration
  - 10 Public
  - 11 Unavailable
- [ ] Keyboard-only pass: Tab reaches the menu, title, Share, Settings, all four capsule buttons, the privacy chip, Help, and every dialog control. The focus ring is visible on indigo and on white.
- [ ] Emulate `prefers-reduced-motion: reduce` and confirm there are no panel, modal, or card transitions.
- [ ] Contrast spot-checks:
  - `--muted` on `--canvas` is at least 4.5:1.
  - White on `--primary` is at least 4.5:1.
  - `--danger` on `--panel` is at least 4.5:1.

## Plan Self-Review

- Every Figma decision in the spec maps to a task:
  - tokens and font: Task 1
  - cards and connectors: Tasks 2–3
  - chrome: Task 4
  - surfaces: Task 5
  - login: Task 6
  - dialogs: Task 7
  - public page: Task 8
- The only logic added is three pure, unit-tested helpers. Firebase, sync, migration, and publishing code paths are untouched.
- Tests that assert copy were checked. The kept names are listed in Global Constraints. Copy that changes is not asserted by any test, or is changed together with its test. The public `/edit/i` guard is respected.
- Two decisions differ from Figma on purpose:
  - The login field label stays "Email address", for the test and for clarity.
  - The migration summary keeps "N people".
  
  Both are noted in their tasks.
- `OwnerSession` currently overlaps the new top bar, so Task 4 moves it into Settings. Without that move the redesign would visually collide.
