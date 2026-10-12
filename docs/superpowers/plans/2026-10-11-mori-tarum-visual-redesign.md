# Heritg "Mori & Tarum" Visual Redesign Plan

> **For agentic workers:** Steps use checkbox (`- [ ]`) syntax for tracking. Tasks 1–2 happen in Figma and are blocked on the Figma MCP quota; Tasks 3–10 are code tasks and can start independently once the design is approved.

**Goal:** Finish verifying the redesigned Figma screens, then bring the new visual system into the Next.js app without changing behavior.

**Spec:** `docs/superpowers/specs/2026-10-11-mori-tarum-visual-redesign-design.md`

**Figma:** https://www.figma.com/design/h7ZwKUiWepibq9xA1pLNIK (file key `h7ZwKUiWepibq9xA1pLNIK`, team "Imam's Starter team", account wahyu@rekosistem.com)

## Status as of 2026-10-11

Done in Figma:

- Foundations: variables renamed and recolored, text styles switched to Plus Jakarta Sans, effect styles cooled, `PersonCard` redesigned, `Button` and `IconButton` softened, tree component converted to year labels with rounded connectors.
- Screens-wide pass over all 33 frames: detached fonts remapped (61 runs), hardcoded colors mapped to tokens (69 nodes), copy rewritten (91 strings, 6 eyebrow labels removed), chrome consolidated on the 16 desktop/tablet workspace frames and the 8 mobile frames.
- Login rebuilt at Desktop, Tablet, and Mobile with the silsilah illustration.
- Visually verified after the redesign: Workspace (desktop, mobile), Person panel (desktop), Share (desktop), Login (all three), Demo Tree component.

Blocked: the Figma MCP Starter-plan tool-call limit was reached before the remaining screens could be checked.

## Global Constraints

- No behavior, routing, Firebase, Rules, or data-model changes. Only presentation and copy.
- Keep every accessible name that tests or users rely on, unless the copy table below explicitly changes it, and update the affected test in the same task.
- Keep the 210×108 person-card slot so `layoutTree()` spacing (250 × 190) and connector anchors stay valid.
- Respect `prefers-reduced-motion`, visible keyboard focus, and WCAG AA contrast (`text/muted` `#5C6478` on `#EEF0EB` is about 5.3:1).
- Soga (`#9A5B2E`) appears at most once per screen outside the login illustration.
- Figma MCP on the Starter plan has a small call budget: batch each Figma task into as few `use_figma` calls as possible (one write call plus one screenshot call per task is the target).

---

### Task 1: Finish Figma verification (blocked on MCP quota)

**Frames to screenshot and inspect** (Screens page `2:214`):

| Flow | Desktop | Tablet | Mobile |
|---|---|---|---|
| Family trees sidebar | `6:2021` | `9:5001` | `10:6429` |
| Empty tree | `6:2139` | `9:5334` | `10:6494` |
| Import local trees (migration) | `7:2783` | `9:5691` | `10:7145` |
| Public tree — read-only | `4:1555` | `9:6024` | `10:7485` |
| Person panel (mobile) | — | `9:4044` | `7:3171` |
| Also re-check | Add member `3:897`, Conflict `6:2518`, Unavailable `7:3151` | `9:4356`, `9:5394`, `9:6214` | `7:3500`, `10:6841`, `10:7752` |

- [ ] **Step 1:** One `use_figma` call that switches to page `2:214` and calls `node.screenshot({scale: 0.42})` on the desktop frames of the first five rows; inspect.
- [ ] **Step 2:** Same for their tablet and mobile counterparts (second call), or use `get_screenshot` on a few if the budget is tight.
- [ ] **Step 3:** Check each frame for the suspected leftovers below and fix them in a single batched write call:
  - Migration dialog still has hardcoded amber warning colors (`#DFC28D` stroke, `#785A20` text). Keep amber for warning semantics, but confirm contrast on `accent/warning`.
  - Migration row checkboxes are bound to `accent/primary`. Confirm the white check still reads.
  - Sidebar "Heritg Family+" row: confirm it now reads as quiet info (`accent/primary-soft` fill, ink text, copy "Inviting other editors is coming later").
  - Empty-state brand mark: the gradient was replaced with solid soga. Confirm it is the only soga element on that screen.
  - Public header: brand mark (soga), badge text "Shared by link", meta "View only. Published version 12". On mobile, check the two-row header still fits with the longer badge text.
  - **Copy conflict with tests:** the public footer note currently reads "You’re viewing a shared copy. Only the owner can edit." `PublicTree.test.tsx` asserts that no text matches `/edit/i` on the public page. Rewrite it in Figma to "You’re viewing a shared copy kept by the archive owner."
  - Any text still using Libre Baskerville or Nunito Sans (search with `findAllWithCriteria({types:['TEXT']})` and check `fontName.family`).
  - Mobile person panel `7:3171`: "Born 21 June 1961" and the "Add a relative" label style.
- [ ] **Step 4:** Take one post-fix screenshot per changed frame and stop.

### Task 2: Design sign-off

- [ ] Share the Figma link with the owner and confirm the direction (palette, Plus Jakarta Sans, removed controls, new copy) before any code changes.
- [ ] Record any requested changes back into the spec.

---

> **Superseded:** Tasks 3–10 below are the original outline. The step-by-step implementation plan with code, tests and file-level changes is `docs/superpowers/plans/2026-10-11-mori-tarum-ui-implementation.md` — follow that one.

## File Map (code tasks)

- `src/app/globals.css`: color tokens, font variable.
- `src/app/layout.tsx`: `next/font/google` Plus Jakarta Sans.
- `src/features/tree/model.ts` (+ `model.test.ts`): `lifespanLabel()`, `generationCount()`, `connectorPath()`.
- `src/features/tree/Workspace.tsx`, `workspace.module.css`: card markup, chrome consolidation, copy.
- `src/app/tree/[publicId]/PublicTree.tsx`, `publicTree.module.css`: shared card and connectors, header copy.
- `src/app/login/page.tsx`, `login.module.css`, new `src/app/login/SilsilahIllustration.tsx`.
- `src/features/tree/components/{PublishDialog,ConflictDialog,MigrationDialog,SyncStatus}.tsx`: inline styles move to tokens; copy updates.

### Task 3: Tokens and font

**Files:** `src/app/globals.css`, `src/app/layout.tsx`

- [ ] Replace `:root` variables with the spec palette. Keep the existing variable names where components already use them (`--canvas`, `--surface`, `--ink`, `--muted`, `--line`, `--brand`, `--plum`, `--green`), mapping `--plum` to tarum `#2B3A67` and `--brand` to soga `#9A5B2E`. Then add the new semantic names (`--primary`, `--soga`, `--connector`, …) and migrate usages gradually.
- [ ] Load Plus Jakarta Sans with `next/font/google` (weights 400, 500, 700, 800). Expose it as `--font-sans` and point `--font-serif` at it as well, so existing `var(--font-serif)` usages pick it up until they are cleaned.
- [ ] Update the focus ring to indigo: `outline: 3px solid rgba(43,58,103,.32)`.
- [ ] `npm run build` to confirm the font loads.

### Task 4: Person card and year labels

**Files:** `src/features/tree/model.ts`, `model.test.ts`, `Workspace.tsx`, `workspace.module.css`, `PublicTree.tsx`, `publicTree.module.css`

- [ ] Add `lifespanLabel(person): string` returning `Born 1961`, `1940 – 2000`, `Died 2015` (death only), or `Years unknown`, with unit tests for each case.
- [ ] Card markup: drop the `MoreHorizontal` icon, show `lifespanLabel` (or "Private" when the privacy toggle is on), and clamp the name to two lines (`-webkit-line-clamp: 2`).
- [ ] CSS: 44px avatar, 14px radius, 1px `--line` border. Selected state: 2px indigo border, indigo avatar with white initial, selected shadow.
- [ ] Apply the same card style to the public read-only page.

### Task 5: Rounded connectors

**Files:** `model.ts`, `model.test.ts`, `Workspace.tsx`, `PublicTree.tsx`

- [ ] Extract `connectorPath(from, to, type, radius = 12)` from the duplicated inline path logic in `Workspace.tsx` and `PublicTree.tsx`. Partners use a straight line between card edges. Parent→child uses a vertical, then a rounded elbow, then a horizontal, then a rounded elbow, then a vertical, with a straight vertical when x is equal.
- [ ] Unit-test the straight case and both elbow directions.
- [ ] Stroke 1.5px, `--connector`.

### Task 6: Consolidate canvas chrome

**Files:** `Workspace.tsx`, `workspace.module.css`

- [ ] Remove the top-bar "Heritg Family+" button. Keep the sidebar entry, restyled as a quiet info row with the copy "Inviting other editors is coming later".
- [ ] Remove the bottom-left eye button. The privacy chip remains the single toggle (keep its `aria-pressed` semantics).
- [ ] Remove the "Branch depth" button (it has no handler).
- [ ] Wrap people, zoom in, zoom out, and fit in one capsule (`border-radius: 999px`, 4px padding, buttons without their own border or shadow). Vertical on the right on desktop; horizontal at bottom-right on mobile, with the FAB at bottom-left (52px).
- [ ] Remove the border from the sync chip and give it the soft shadow.

### Task 7: Copy updates

**Files:** as listed. Update the affected tests in the same commit.

| Location | Old | New |
|---|---|---|
| Tree title meta | `20 people · 31 relationships` | `20 people across 5 generations` (`generationCount()` from `layoutTree` levels; `No one added yet` when empty) |
| Local status | `Local only` | `Saved on this device only` |
| Privacy chip | `Protected` / `Visible` | `Dates hidden` / `Dates shown` |
| Person panel label | `Grow this branch` (rendered uppercase) | `Add a relative` (no uppercase transform) |
| Person panel dates | ISO date | `Born 21 June 1961` (locale date) |
| Sidebar eyebrow | `A PRIVATE FAMILY ARCHIVE` | `Your private family archive` |
| Sidebar tree meta | `20 people · Oct 11` | `20 people, edited Oct 11` |
| Publish dialog eyebrow | `UNLISTED SHARING` | remove |
| Publish dialog meta | `Published revision N · Public update pending` | `The link shows version N. Your newest edits aren’t public yet.` (or `The link shows version N.` when current) |
| Migration eyebrow | `MOVE YOUR ARCHIVE ONLINE` | remove |
| Migration row meta | `N people · M relationships · Imported` | `N people, M relationships` / `Already imported` |
| Public badge | `UNLISTED` | `Shared by link` |
| Public meta | `Read-only family tree · Published revision N` | `View only. Published version N` |
| Login note | `Owner access only. New accounts are created privately by the archive owner.` | `Only the archive owner has an account. Family members view trees through links the owner shares.` |

- [ ] Keep these test-relied names unchanged: "Publish with link", "Copy link", "Update public version", "Regenerate link", "Unpublish", "Sign in", "Forgot your password?", "Send reset link", "Postpone", "Retry migration", "Replace online with my version", and "This family tree is unavailable".
- [ ] Make sure no new public-page copy contains the word "edit" (`PublicTree.test.tsx` asserts `/edit/i` is absent).
- [ ] The `MigrationDialog` test checks `"1 people"` in the summary. Leave the summary format as is, or update the test if pluralization is fixed.

### Task 8: Login redesign

**Files:** `src/app/login/page.tsx`, `login.module.css`, `src/app/login/SilsilahIllustration.tsx`

- [ ] `SilsilahIllustration`: inline SVG, `aria-hidden="true"`, five rows (4/2/2/6/6) with rounded-elbow links; one lineage in soga (`#D49A66` on indigo), other nodes as outlined circles. Geometry matches the Figma "Silsilah illustration" nodes in frames `16:5291` / `16:5374` / `16:5454`.
- [ ] Desktop (≥ 768px): two columns. Indigo panel on the left with wordmark, illustration, and the sentence "Keep your family’s story in one place, private until you choose to share it."; form on the right (max-width 360px).
- [ ] Tablet: panel 380px tall above the form (max-width 400px). Below 520px: 220px band and a full-width form with 24px gutters.
- [ ] Keep all existing login behavior, error and success messages, and accessible names.

### Task 9: Dialogs and public page restyle

**Files:** `PublishDialog.tsx`, `ConflictDialog.tsx`, `MigrationDialog.tsx`, `SyncStatus.tsx`, `publicTree.module.css`

- [ ] Replace the hardcoded inline colors in the three dialogs with CSS variables (consider moving them to CSS modules). Use indigo for primary buttons, a `--danger` outline for Unpublish, and the cool backdrop `rgba(28,35,64,.45)`.
- [ ] Give `ConflictDialog` the card layout from the Figma frame (title, two paragraphs, full-width buttons).
- [ ] Public header: soga brand mark, "Shared by link" badge, two-row layout below 700px as today.

### Task 10: Verification

- [ ] `npm test -- --run`, `npm run lint`, `npm run build` all pass.
- [ ] Run the dev server and compare against Figma at 1440×900, 768×1024, and 390×844 for: login, workspace, person panel, add member, share, sidebar, empty tree, public tree.
- [ ] Keyboard pass: focus is visible on every control in the capsule, top bar, dialogs, and login.
- [ ] Reduced-motion pass: no transitions when `prefers-reduced-motion: reduce`.

## Plan Self-Review

- Figma work (Tasks 1–2) is isolated from code work, so the code tasks are not blocked by the MCP quota once the direction is approved.
- No task touches Firebase, Rules, sync, or migration logic. Only presentation, copy, and three pure helpers (`lifespanLabel`, `generationCount`, `connectorPath`) that get unit tests.
- Every copy change that touches a tested string is called out, including the `/edit/i` assertion on the public page.
- The card slot size is preserved, so the layout algorithm and existing tree data render unchanged.
