# Heritg × heritg.us Parity Plan

> **For agentic workers:** Follow AGENTS.md roles. Each phase is one PR-sized unit. Each phase ends with `npm test -- --run`, `npm run lint`, `npm run build` (plus `npm run test:rules` when Rules or repositories change), a side-by-side screenshot check against heritg.us, and a commit. Phases 1, 5 and 6 touch Firestore Rules or repositories, so `reviewer` (Opus 5.5) is mandatory for them.

**Goal:** Reproduce heritg.us look, copy and behaviour on top of our Firebase owner-login + Firestore architecture.

**Spec:** `docs/superpowers/specs/2026-10-11-heritg-us-parity-design.md`
**Measurements:** `docs/superpowers/specs/2026-10-11-heritg-us-reference.md`
**Branch:** `feat/heritg-us-parity`, based on `feat/mori-tarum-ui` so it keeps the Firestore and example-tree fixes.

## Global constraints

- Re-implement from measurements. Never copy heritg.us source, CSS files or image assets.
- Keep the security properties: owner-only private data, scoped public reads, no anonymous writes, Rules tests green.
- Indonesian is the default UI language. Every string lives in the i18n catalog with `id`, `en` and `ms` entries.
- Keep the accessible names that tests use, or update the tests in the same commit.
- Capture any heritg.us screen not yet in the reference before building it: mobile 390 px, Kipas details, Semua orang item styles, Bagikan sub-flows, date picker, sidebar kebab menu. Append the findings to the reference doc.

---

## Phase 0 — Foundations: tokens, font, i18n, shell chrome

**Files:**
- `src/app/globals.css`, `src/app/layout.tsx`
- new `src/i18n/{index.ts,id.ts,en.ts,ms.ts}`
- `Workspace.tsx`, `workspace.module.css`
- new `src/features/tree/components/CoachMarks.tsx`

- [ ] **Tokens and font.** Replace the Mori & Tarum tokens with the heritg.us palette (see the reference: `--base`, `--brand`, `--brand-deep`, `--canvas`, `--tree-canvas`, `--line`, `--recessed`, `--subtle`, `--text`, `--add`, `--danger`, `--family-plus*`, `--shadow`, `--shadow-soft`). Switch the font to Assistant via `next/font/google`.
- [ ] **i18n catalog.** Add a tiny `t(key, vars)` helper with an `id` default. Store the app-language choice in local settings.
- [ ] **Shell chrome, measured from the reference:**
  - menu button;
  - title card with pencil button and "N orang · N hubungan";
  - Family+ gradient button, Bagikan, and Setelan;
  - right control column: Semua orang, Jumlah turunan cabang, Zoom In, Zoom Out, Pas ke layar;
  - bottom-left: Sembunyikan kontrol (eye) and the Tampilan pohon chip;
  - bottom-right: privacy chip "Dilindungi" and Bantuan.
- [ ] **Empty state.** Flower mark and wordmark; copy "Mulai dari siapa aja bebas" and its three options plus the drag hint.
- [ ] **Coach marks 1–4.** Hand-drawn arrow SVGs, numbered badges, shown while the tree is empty. Dismiss them permanently after the first person is added.
- [ ] **Sembunyikan kontrol.** Hides all floating chrome except the eye toggle.
- [ ] **Tests:**
  - i18n fallback;
  - coach marks visible only on an empty tree;
  - hide-controls toggle.

## Phase 1 — Data model v2 + migration (reviewer required)

**Files:**
- `model.ts`, `domain/{onlineTypes,serialization}.ts`
- `repository/*`
- `firestore.rules`, `tests/rules/*`
- `demoData.ts`, `useWorkspace.ts`, `LocalTreeCache.ts`

- [ ] **Person v2 and relationship v2.** Implement the shapes from the spec, with pure helpers for the wizard's relationship statuses (`statusToRelationship`, `relationshipToStatus`).
- [ ] **Migration v1 → v2.** Write pure functions with tests, then wire them in:
  - local cache on read;
  - `.heritg` import of v1 and v2, with export as v2;
  - Firestore lazy upgrade on first owner load, as a revision-checked save.
- [ ] **Rules for the v2 person and relationship schema.** Keep the v1 shape readable during the transition window. Emulator tests cover:
  - valid and invalid v2 documents;
  - owner-only access;
  - public snapshots without owner data.
- [ ] **Example tree in v2 with real genders**, still read-only.

## Phase 2 — SVG canvas, kinship labels, Fokus / Lengkap

**Files:**
- new `src/features/tree/canvas/{TreeCanvas.tsx,layoutFocus.ts,layoutFull.ts,kinship.ts,kinshipTerms/*.ts}`
- `Workspace.tsx`

- [ ] **Kinship engine and term tables** (`id`, `jv-yogya`, `ms`, `en`), with a fixture-family test suite covering every label.
- [ ] **Focus layout.** Selected person plus parents, partners and children, with "Tampilkan saudara". "Leluhur lainnya" and "Keturunan lainnya" expand one generation each.
- [ ] **Full layout.** 260 px generational grid with orthogonal bus connectors and partner lines. Reuse and replace `layoutTree` and `connectorPath`.
- [ ] **SVG node rendering:**
  - circle r=32 with inner r=27, gender fill and stroke;
  - initial, or a photo clipped to the inner circle;
  - name in 14/700 and relation label in 13/500.
  - Invisible hit buttons keep `aria-label="<Name>, <Gender>"` and `aria-pressed`.
- [ ] **Selected action dots** (edit #a8875b, add #7e9b63), 28 px visible with 44 px hit areas.
- [ ] **Interaction.** Pan with drag and wheel, zoom buttons, Pas ke layar, and keyboard focus on nodes.
- [ ] **Tampilan pohon popover:**
  - segmented control Fokus | Lengkap | Kipas;
  - "Jelajahi keluarga dari" person picker;
  - "Menampilkan X dari Y orang";
  - the siblings checkbox;
  - the more-ancestors / more-descendants buttons.
- [ ] **"Hubungan" legend chip** for the Lengkap view.
- [ ] **"Jumlah turunan cabang" popover.** Measure it on heritg.us first.
- [ ] **Public read-only viewer** renders through the same `TreeCanvas`, without action dots.

## Phase 3 — Dialogs: start, add-relative wizard, edit profile

**Files:** new `src/features/tree/dialogs/{Dialog.tsx,StartDialog.tsx,AddRelativeWizard.tsx,EditProfileDialog.tsx,DiscardConfirm.tsx,DatePicker.tsx,PhotoPicker.tsx}`

- [ ] **Shared dialog shell.** 620 / 780 widths, radius 22, header and footer bars, scroll body, and focus trap.
- [ ] **"Batal simpan?" confirmation** whenever a dirty form is closed.
- [ ] **StartDialog ("Mulai bikin silsilah").** Photo card, Nama, and a collapsible "Tambah info (opsional)" with Tanggal lahir, Anak ke-berapa, Tanggal wafat and Domisili.
- [ ] **AddRelativeWizard:**
  - stepper;
  - step 1: new or link existing, the latter disabled with a hint when nobody else exists;
  - step 2: grouped statuses, with the remaining groups measured on heritg.us;
  - step 3: profile, with Tanggal nikah for spouses and the avatar tinted by implied gender;
  - submit label "Tambah anggota keluarga".
- [ ] **EditProfileDialog:**
  - Biodata lengkap and Catatan tambahan;
  - a Keluarga list with edit-marriage-date, edit-relationship and remove actions;
  - "Sambungin anggota keluarga";
  - save and delete person.
- [ ] **DatePicker** matching the heritg.us button-style picker (measure first).
- [ ] **PhotoPicker.** Upload with client-side resize and compression; store inline thumbnails per the spec, with the matching Rules.

## Phase 4 — Panels

- [ ] **Sidebar:**
  - head;
  - "Silsilah keluarga" with a plus button;
  - search;
  - tree item cards with an "Atur Silsilah" kebab (rename, duplicate, export, delete — measure first);
  - Silsilah baru and Impor file;
  - menu rows Heritg Family+, Perlindungan privasi, Bantuan, Laporin bug.
- [ ] **Semua orang.** Search plus a list showing relation labels; clicking a row selects that person and centers the canvas.
- [ ] **Setelan:**
  - Family+ status, mapped to our sync;
  - Akun, showing the owner with Sign in / Sign out;
  - Bahasa aplikasi (id / en / ms);
  - Sebutan status keluarga (dialect for kinship terms).
- [ ] **Bantuan and Perlindungan privasi.** Copy adapted to our architecture, per the spec.
- [ ] **Heritg Family+ dialog** (benefits list), with the CTA mapped to the online-sync explanation.

## Phase 5 — Share / export (reviewer required for the web link)

- [ ] **Bagikan / Ekspor panel.** Four cards: Bikin Link Web, File Backup HERITG, File GEDCOM, Simpan Gambar.
- [ ] **Backup.** `.heritg` v2 export and import, including inline photos.
- [ ] **GEDCOM 5.5.1 export**, plus import (persons, families, step / adoptive pedigree via `PEDI`), with round-trip tests.
- [ ] **Simpan Gambar.** PNG via an offscreen canvas from the SVG, and SVG download.
- [ ] **Password-protected web link:**
  - PBKDF2 → AES-GCM snapshot encryption;
  - a new public-snapshot shape, with Rules and emulator tests;
  - a viewer password prompt;
  - the "Yang bakal kelihatan di link" privacy options (dates, photos, ages).

## Phase 6 — Kipas (fan chart)

- [ ] **Kipas page:**
  - Kembali and Kembali ke pohon;
  - Generasi and Ukuran bagan selects;
  - an SVG semicircle of ancestors over a lower half of children, in gender colors;
  - "Belum tercatat" placeholders;
  - tap to re-root;
  - the list below the chart.

## Phase 7 — Mobile parity, polish, verification

- [ ] **Mobile.** Capture heritg.us at 390 px and match the layout: chrome, panels as sheets, dialogs full-screen.
- [ ] **Reduced motion, keyboard and contrast pass.**
- [ ] **Side-by-side screenshot review** of every screen. Then run the full test, lint, build and test:rules suite.
- [ ] **Docs.** Update README, AGENTS.md (UI language, data v2) and the Figma file (optional, MCP quota permitting).

## Self-review

- Every heritg.us feature in the reference maps to a phase. Architecture conflicts are resolved in the spec, not left to implementers.
- Phases 0, 2, 3 and 4 are presentation and logic without Rules changes, so they can start before Phase 1 is reviewed. Phase 2's relationship statuses do depend on Phase 1's model, so Phase 1 must merge before Phase 3's wizard step 2.
- The riskiest pieces, schema v2 Rules and the encrypted web link, are isolated in their own phases with mandatory review and emulator tests.
