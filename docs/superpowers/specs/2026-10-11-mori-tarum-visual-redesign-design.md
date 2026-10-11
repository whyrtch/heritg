# Heritg Visual Redesign: "Mori & Tarum"

## Objective

Replace Heritg's current look (warm cream ground, high-contrast serif, brown/plum accents) with a calmer, less rigid visual system rooted in the product's subject: a private Indonesian family archive (*silsilah*). Product behavior, routes, data model, and security rules do not change.

The design was produced in Figma using the `frontend-design` skill (`.agents/skills/frontend-design/SKILL.md`). Source of truth for visuals:

- Figma file: https://www.figma.com/design/h7ZwKUiWepibq9xA1pLNIK
- Page **Foundations & Components**: color variables, text styles, effect styles, icon components, `IconButton`, `Button`, `PersonCard`, `Demo Tree / Keluarga Joko Widodo`.
- Page **Screens**: responsive matrix, 11 flow rows × 3 columns (Desktop 1440 at x=0, Tablet 768 at x=1540, Mobile 390 at x=2408).

## Why the old look was replaced

The `frontend-design` skill lists recurring "generated design" defaults. The previous Heritg UI matched several of them at once:

- Warm cream background with a high-contrast serif display and a brown accent.
- Tracked all-caps eyebrow labels ("A PRIVATE FAMILY ARCHIVE", "UNLISTED SHARING", "GROW THIS BRANCH").
- Meta strings joined with middle dots ("20 people · 31 relationships").
- Chrome scattered across five screen corners, with a duplicated privacy toggle (eye button and "Protected" chip did the same thing) and a primary-styled button for a feature that does not exist yet ("Heritg Family+").
- Person cards truncated most names ("Joko Wi…") and showed raw ISO dates.

## Design tokens

### Color (Figma collection "Heritg Color — Mori & Tarum")

| Token | Hex | Role |
|---|---|---|
| `bg/canvas`, `bg/login`, `bg/public` | `#EEF0EB` | Cool off-white ground, like *kain mori* (undyed batik cloth) |
| `bg/surface`, `bg/input` | `#FFFFFF` | Cards, inputs |
| `bg/panel` | `#F7F8F5` | Side panel, dialogs |
| `bg/sidebar` | `#F3F5F1` | Tree list drawer |
| `bg/avatar` | `#DFE5F0` | Avatar fallback |
| `bg/info`, `bg/key` | `#E9EDF4`, `#E3E8F2` | Info boxes, icon wells |
| `text/ink` | `#1C2340` | Primary text |
| `text/muted` | `#5C6478` | Secondary text |
| `text/initials` | `#2B3A67` | Avatar initials |
| `text/danger` | `#A23B3B` | Destructive actions, errors |
| `border/line`, `border/card` | `#D6DBD3`, `#CDD3CB` | Hairlines, card outlines |
| `border/connector` | `#A3ABBE` | Tree connector lines |
| `accent/primary` | `#2B3A67` | *Tarum* indigo: primary actions, selection |
| `accent/primary-soft` | `#E3E8F2` | Soft indigo fills |
| `accent/soga`, `accent/soga-strong` | `#9A5B2E`, `#8A4F26` | *Soga* brown: brand mark and heritage moments only |
| `accent/green` | `#3F7A5A` | Saved / safe state |
| `accent/warning` | `#F6EBD3` | Warning background |

Indigo and soga are the two dyes of classic Javanese *batik sogan*, which is where the pairing comes from. Soga is deliberately rare: if it appears on more than one element per screen, the screen is too loud.

### Typography

One family: **Plus Jakarta Sans** (Tokotype, Jakarta). The serif is removed.

| Style | Weight / size / line height |
|---|---|
| Heading/Display 30 | ExtraBold 30 / 36, −2% tracking |
| Heading/Title 22 | Bold 22 / 28, −1% |
| Heading/Tree name 16 | Bold 16 |
| Card/Name 15 | Bold 15 / 19, max 2 lines |
| Card/Initial 17 | Bold 17 |
| Brand/Wordmark 22 | ExtraBold 22, −2% |
| Body/Regular 14 | 14 / 150% |
| Body/Strong 14, Label/13, Label/Section 12 | Bold |
| Caption/12, Caption/11 | 12 / 140%, 11 |

The Figma build of Plus Jakarta Sans lacks Regular and SemiBold, so the design uses Medium for body text. In code, load Regular (400) for body and keep Medium (500) for UI labels if Medium reads heavy at 14px.

### Shape and elevation

- Radius hierarchy: person cards 14, buttons and inputs 10, dialogs 18–20, chips and the control capsule fully rounded.
- Shadows are cool and tight, tinted with `#1C2340`. Soft: `0 1 2 / 5%` plus `0 4 12 / 6%`. Selected: `0 0 0 4px` indigo at 16% plus `0 6 18 / 12%`. Panel: `-12 0 32 / 10%`. Modal: `0 24 60 / 22%`.

## Layout and component decisions

1. **Person card** (210×108 slot is unchanged, so `layoutTree()` and connector geometry still hold): 44px avatar, name wraps to two lines, then a year label: `Born 1961`, `1940 – 2000`, or `Years unknown`. The overflow "⋯" glyph is removed because the whole card is the button. Selected state uses a 2px indigo border and an indigo-filled avatar with white initial.
2. **Connectors** keep the orthogonal route but use 12px rounded elbows, 1.5px stroke, connector-grey.
3. **Canvas chrome** has two zones:
   - Top bar: menu, tree name card with a plain-language summary ("20 people across 5 generations"), a sync chip under it, and Share and Settings on the right.
   - One control capsule (people list, zoom in, zoom out, fit), vertical on desktop/tablet and horizontal at the bottom on mobile.
   - The privacy chip stays as the single privacy toggle. The eye button, the Branch-depth button (it has no handler), and the top-bar "Heritg Family+" button are removed. Family+ remains only as a quiet informational row in the sidebar.
4. **Login** is the one bold element. Desktop splits 50/50: on the left, an indigo panel with a line drawing of a five-generation *silsilah* in which a single lineage is highlighted in soga, plus one sentence; on the right, the form on the canvas color. Tablet stacks the panel (380px) above the form. Mobile uses a 220px band above the form. The illustration is decorative and contains no real family data.
5. **Copy** uses sentence case, no all-caps labels, and no middle-dot meta strings (see the copy table in the plan).

## Breakpoints (unchanged from CSS)

- `< 768px`: mobile workspace (compact top bar, bottom control capsule, FAB, full-width panels).
- `< 700px`: public header wraps to two rows with a left-aligned title.
- `< 520px`: login card becomes full-bleed; photo-URL row stacks.

## Out of scope

- Dark mode.
- Any behavior, routing, Firebase, or data change.
- New features (generation labels, tree switcher dropdown, etc.).
