# Heritg × heritg.us Parity Plan

> **For agentic workers:** Follow AGENTS.md roles. Each phase is one PR-sized unit. Each phase ends with `npm test -- --run`, `npm run lint`, `npm run build` (plus `npm run test:rules` when Rules or repositories change), a side-by-side screenshot check against heritg.us, and a commit. Phases 1, 5 and 6 touch Firestore Rules or repositories, so `reviewer` (Opus 5.5) is mandatory for them.

**Goal:** Reproduce heritg.us look, copy and behaviour on top of our Firebase owner-login + Firestore architecture.

> **Changed 2026-10-11 (owner):** Firebase is being replaced by our own backend (Next.js API + PostgreSQL + own email/password auth). See `docs/superpowers/specs/2026-10-11-own-backend-design.md` and `docs/superpowers/plans/2026-10-11-own-backend.md`, which run before phases 4–7 here. Wherever this plan says Firestore, Rules or `test:rules`, read: the API, DB constraints and `test:api`. The Phase 3 photo upload moved to backend phase B5.

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

- [x] **Person v2 and relationship v2.** Implement the shapes from the spec, with pure helpers for the wizard's relationship statuses (`statusToRelationship`, `relationshipToStatus`).
- [x] **Migration v1 → v2.** Write pure functions with tests, then wire them in:
  - local cache on read;
  - `.heritg` import of v1 and v2, with export as v2;
  - Firestore lazy upgrade on first owner load, as a revision-checked save.
  - _Done in `ed50066`. Firestore documents upgrade on the next owner save (every save rewrites all people and relationships), not with a separate upgrade write._
- [x] **Rules for the v2 person and relationship schema.** Keep the v1 shape readable during the transition window. Emulator tests cover:
  - valid and invalid v2 documents;
  - owner-only access;
  - public snapshots without owner data.
  - _v1 documents stay readable; all writes must be v2._
- [x] **Example tree in v2 with real genders**, still read-only.

## Phase 2 — SVG canvas, kinship labels, Fokus / Lengkap

**Files:**
- new `src/features/tree/canvas/{TreeCanvas.tsx,layoutFocus.ts,layoutFull.ts,kinship.ts,kinshipTerms/*.ts}`
- `Workspace.tsx`

- [x] **Kinship engine and term tables** (`id`, `jv-yogya`, `ms`, `en`), with a fixture-family test suite covering every label.
- [x] **Focus layout.** Selected person plus parents, partners and children, with "Tampilkan saudara". "Leluhur lainnya" and "Keturunan lainnya" expand one generation each.
- [x] **Full layout.** 260 px generational grid with orthogonal bus connectors and partner lines. Reuse and replace `layoutTree` and `connectorPath`.
  - _`layoutTree`/`connectorPath` in `model.ts` are no longer used by the UI; remove them with their tests in Phase 7._
- [x] **SVG node rendering:**
  - circle r=32 with inner r=27, gender fill and stroke;
  - initial, or a photo clipped to the inner circle;
  - name in 14/700 and relation label in 13/500.
  - Invisible hit buttons keep `aria-label="<Name>, <Gender>"` and `aria-pressed`.
- [x] **Selected action dots** (edit #a8875b, add #7e9b63), 28 px visible with 44 px hit areas.
  - _Measured on heritg.us: side by side left of the node (add at -61, edit at -95 scene units); hit areas 34×44._
- [x] **Interaction.** Pan with drag and wheel, zoom buttons, Pas ke layar, and keyboard focus on nodes.
  - _Wheel pans, Ctrl/⌘ + wheel zooms._
- [x] **Tampilan pohon popover:**
  - segmented control Fokus | Lengkap | Kipas;
  - "Jelajahi keluarga dari" person picker;
  - "Menampilkan X dari Y orang";
  - the siblings checkbox;
  - the more-ancestors / more-descendants buttons.
  - _The person picker is a native select for now; the avatar list comes with the Phase 4 panels._
- [x] **"Hubungan" legend chip** for the Lengkap view.
- [ ] **"Jumlah turunan cabang" popover.** Measure it on heritg.us first.
  - _Still open: heritg.us hides this control in Fokus; it needs a larger sample tree in Lengkap to measure. The button stays disabled in Lengkap until then._
- [x] **Public read-only viewer** renders through the same `TreeCanvas`, without action dots.

## Phase 3 — Dialogs: start, add-relative wizard, edit profile

**Files:** new `src/features/tree/dialogs/{Dialog.tsx,StartDialog.tsx,AddRelativeWizard.tsx,EditProfileDialog.tsx,DiscardConfirm.tsx,DatePicker.tsx,PhotoPicker.tsx}`

- [x] **Shared dialog shell.** 620 / 780 widths, radius 22, header and footer bars, scroll body, and focus trap.
- [x] **"Batal simpan?" confirmation** whenever a dirty form is closed.
- [x] **StartDialog ("Mulai bikin silsilah").** Photo card, Nama, and a collapsible "Tambah info (opsional)" with Tanggal lahir, Anak ke-berapa, Tanggal wafat and Domisili.
- [x] **AddRelativeWizard:**
  - stepper;
  - step 1: new or link existing, the latter disabled with a hint when nobody else exists;
  - step 2: grouped statuses, with the remaining groups measured on heritg.us;
  - step 3: profile, with Tanggal nikah for spouses and the avatar tinted by implied gender;
  - submit label "Tambah anggota keluarga".
  - _Measured: exactly four status groups (24 statuses). Step 3 adds "Orang tua bersama (opsional)" for child statuses. Connecting an existing person picks the person in step 3._
- [x] **EditProfileDialog:**
  - Biodata lengkap and Catatan tambahan;
  - a Keluarga list with edit-marriage-date, edit-relationship and remove actions;
  - "Sambungin anggota keluarga";
  - save and delete person.
  - _Includes the "Edit status hubungan" dialog. Family changes are staged until Simpan, as on heritg.us._
- [x] **DatePicker** matching the heritg.us button-style picker (measure first).
  - _Measured: 352 px popover centred in the viewport, month/year selects, Monday first, "Hapus tanggal" / "Hari ini"._
- [ ] **PhotoPicker.** Upload with client-side resize and compression; store inline thumbnails per the spec, with the matching Rules.
  - _Blocked on an owner decision: AGENTS.md says "Photos are HTTPS URLs only; no uploads". For now "Pilih foto" opens an HTTPS link field._

## Phase 4 — Panels

> Detailed on 2026-10-12, after measuring heritg.us (reference section "Panels, measured 2026-10-12").
> - Re-implement from those measurements. Write our own copy; take nothing from heritg.us beyond short UI labels.
> - All six tasks edit `Workspace.tsx`, so they run **sequentially**.
> - Each task ends with `npm test -- --run` and `npm run lint`, and is one commit.

**Shared decisions (the owner may override):**
- **One right-side panel at a time.** `Workspace` holds `rightPanel: "people" | "settings" | "help" | "privacy" | null`. Opening one panel replaces another. The PersonPanel (example tree) stays as it is.
- **Panel semantics.** Panels are `role="dialog"` with `aria-modal="false"` and `aria-label` = the title. They close with a "Tutup" button or Escape, and they do not trap focus.
- **Strings.** New strings go into `src/i18n/{id,en,ms}.ts`. Indonesian is the default.
- **No bug reporting.** There is no "Laporin bug" row or card, because we have no report channel.
- **No payments.** Family+ explains that online sync is part of the owner account.

### Task 4.1 — Side panel shell and Semua orang
**Files:**
- new `src/features/tree/panels/{SidePanel.tsx, PeoplePanel.tsx, panels.module.css, panels.test.tsx}`
- `Workspace.tsx` (wiring; remove `Directory`)
- i18n catalogs

- [x] **`SidePanel`:**
  - fixed to the right, 390 wide, full height;
  - header 68 high with an h2 (17.28/700) and a "Tutup" close button;
  - body with padding 20 that scrolls;
  - Escape closes it;
  - under 600 px it is full width (the mobile sheet comes in Phase 7).
- [x] **`PeoplePanel` search and list:**
  - The search input (type=search, label "Cari orang") filters case-insensitively.
  - Each row shows a 44 avatar in the gender tint. It shows the photo if there is one, unless privacy masking is on.
  - Each row shows the name and a subline:
    - the kinship label relative to the selected person (`kinshipLabels` with the chosen dialect);
    - "Dipilih" for the selected person;
    - otherwise "Anggota keluarga".
  - Each row ends with an arrow-right icon.
- [x] **`PeoplePanel` behaviour:**
  - Clicking a row closes the panel, selects the person and centres on them (`focusPerson`).
  - When nothing matches, it shows "Nggak ada yang cocok".
- [x] **Tests:**
  - the filter;
  - the subline labels;
  - a row click selects the person and closes the panel;
  - in the Workspace test, opening "Semua orang" and jumping to a person.

### Task 4.2 — Setelan
**Files:**
- new `src/features/tree/panels/SettingsPanel.tsx` and its tests
- new `src/features/tree/canvas/dialectSetting.ts` (a `useSyncExternalStore` store, key `heritg.kinshipDialect`, default "id")
- `Workspace.tsx`, i18n

- [x] **Akses Family+ group:**
  - a gradient card titled "Heritg Family+";
  - a badge: "Aktif" when signed in, "Belum aktif" otherwise;
  - a sync sub-row ("Sinkron online") with a status pill from the active tree: "Tersimpan", "Menyimpan…", "Offline", "Perlu dicek" (conflict or error), or "Cuma di perangkat ini";
  - a full-width gradient button that opens the Family+ dialog.
- [x] **Akun group:** "Akun pemilik" with the email or "Belum masuk", plus the existing `OwnerSession` sign-in and sign-out.
- [x] **Bahasa aplikasi group:** a two-column option grid (Bahasa Indonesia / English / Bahasa Melayu) with `aria-pressed`, calling `setLanguage`.
- [x] **Sebutan status keluarga group:**
  - one option per `KINSHIP_DIALECTS` entry: Bahasa Indonesia, Basa Jawa (Yogyakarta), Bahasa Melayu, English;
  - stored via `dialectSetting`;
  - `Workspace` passes the dialect to `kinshipLabels`.
- [x] **Perangkat ini group:** keep the existing "Reset device cache" button. Its confirmation must say that edits not yet synced are lost too.
- [x] **Footer:** a note row with a shield-check icon, and a version line from the `version` in `package.json`.
- [x] **Remove the old Settings panel** and its "Privacy protection" toggle. Masking moves to the privacy panel (4.3).
- [x] **Tests:**
  - switching the language re-renders the UI;
  - choosing a dialect changes a kinship label on the canvas;
  - the sync pill maps every status;
  - the copy for a signed-out account.

### Task 4.3 — Bantuan and Perlindungan privasi
**Files:** new `src/features/tree/panels/{HelpPanel.tsx, PrivacyPanel.tsx}` and their tests, `Workspace.tsx`, i18n.

- [x] **Bantuan.** An intro paragraph, then six help items. Each has a 38 icon tile, a title and text, all in our own words:
  - pan and zoom the canvas (drag, wheel, Ctrl/⌘ + wheel);
  - add and edit relatives (the + and the pencil next to a person);
  - manage trees (the menu at the top left: new, rename, copy, import);
  - find people (Semua orang);
  - the Fokus and Lengkap views, with the depth buttons;
  - sync and offline: edits wait on this device and are sent once back online.
- [x] **Perlindungan privasi.** A green status card, then help items that describe **our** model honestly:
  - only the owner account can read or change private trees, and the server checks every request;
  - passwords are hashed (Argon2id) and sessions are HTTP-only cookies;
  - this browser keeps an **unencrypted** offline copy, so use a trusted device and sign out on shared ones;
  - a public link is read-only, anyone who has it can view it, and it can be revoked;
  - exported `.heritg` files are readable by anyone who has them.
- [x] **Masking toggle.** Keep the existing toggle here, labelled "Samarkan tanggal dan foto di daftar".
- [x] **Privacy chip.** The canvas chip keeps "Dilindungi", but its panel must not claim device encryption.
- [x] **Tests:**
  - both panels open from their chrome buttons;
  - both open from the sidebar rows (after 4.4);
  - the copy makes no claim that this device is encrypted ("enkripsi" / "encrypted").

### Task 4.4 — Sidebar
**Files:**
- new `src/features/tree/panels/{TreeSidebar.tsx, TreeMenu.tsx}` and their tests
- `model.ts`: `duplicateTree`, which gives new person and relationship ids and the name "<name> (salinan)", with unit tests
- `Workspace.tsx`, i18n

- [x] **Head and search** (following the reference):
  - 304 wide, sliding in from the left;
  - the head holds the logo, "Heritg", "Arsip keluarga pribadi" and a "Tutup" close button;
  - a "Silsilah keluarga" section with a round "Silsilah baru" plus button;
  - a search box that filters the tree cards.
- [x] **Tree cards and actions:**
  - Each card has a tree-icon avatar, the name, and "N orang · 11 Okt" (or "contoh" for the example).
  - The active card has `aria-current`.
  - Buttons: "Silsilah baru" (primary) and "Impor file".
  - Plus "Ekspor file", kept until Phase 5 moves export into Bagikan.
- [x] **Menu rows:**
  - Heritg Family+ (a gradient row that opens the dialog);
  - Perlindungan privasi (opens the panel);
  - Bantuan (opens the panel).
- [x] **Kebab "<name>: Atur Silsilah"** with `aria-expanded`. It closes on Escape or an outside click. Its popover has these items:
  - "Bikin salinan keluarga": first embed the photos with `withEmbeddedPhotos`, then hand the copy to `addTree`. A signed-in owner therefore uploads it and its photos are queued.
  - "Ubah nama": a 430 `Dialog` with the field "Nama silsilah keluarga" (maxlength 160) and Batal / Simpan. It also replaces the `prompt()` behind the title pencil.
  - "Hapus": handled in 4.5. Until then the item is not rendered.
  - On the example tree the menu offers only "Bikin salinan keluarga" (an editable copy).
- [x] **Tests:**
  - the search filter;
  - duplicating creates new ids and keeps the relationships consistent;
  - renaming through the dialog;
  - the example tree's menu has no rename;
  - the sidebar menu rows open the right panels.

### Task 4.5 — Delete a tree (reviewer required: touches sync and the server)
**Files:** `TreeMenu.tsx`, `Workspace.tsx`, i18n, tests. The server and API do not change: `DELETE /api/trees/:id` already exists and is owner-scoped.

- [x] **Confirmation dialog.** "Hapus" opens a 430 dialog titled "Hapus <name>?". It shows the person and relationship counts and says that:
  - the tree is removed from the account and from this device;
  - its public link stops working.
  - The danger button reads "Hapus silsilah".
- [x] **Synced tree** (it has a remote id): call `HttpTreeRepository.delete` first.
  - **Only if that succeeds**, remove the local tree and everything tied to it:
    - its cached online copy;
    - its pending operations;
    - its migration mapping;
    - its photo queue entries.
  - Then switch to another tree, or to a new empty tree when none is left.
  - **When offline or on failure,** keep everything and show "Silsilah ini perlu online buat dihapus".
- [x] **Local-only tree:** remove it from this device.
- [x] **The example tree** cannot be deleted.
- [x] **Tests:**
  - a successful online delete removes the local data;
  - an offline failure keeps every local byte;
  - deleting the active tree selects another.
- [x] **Reviewer (Opus 5.5)** before the commit. Approved.
- _Follow-ups (reviewer, low):_
  - _A save already in flight can write back a stale `onlineTrees` entry after the delete. Nothing reads it._
  - _A mapping whose upload never completed is deleted locally only, which can leave an orphan tree on the server._
  - _A 404 from another account signed in on the same device counts as success._

### Task 4.6 — Heritg Family+ dialog
**Files:** new `src/features/tree/panels/FamilyPlusDialog.tsx` and its tests, `Workspace.tsx`, i18n.

- [ ] **A 620 `Dialog` titled "Heritg Family+".** It contains:
  - a gradient benefits box with a sparkles title "Yang sudah kamu dapat" and three items mapped to our features:
    - sync to the owner account across devices;
    - an offline copy that sends edits once back online;
    - revocable public read-only links;
  - an "everyday features" note;
  - a status block: signed in → "Aktif di akun <email>"; signed out → "Masuk dulu buat sinkron online" with a link to `/login`.
  - Footer: "Mengerti" (primary). No prices and no payments.
- [ ] **Replace the old `deferred` modal** ("Coming in the collaboration release") everywhere.
- [ ] **Tests:**
  - the signed-in variant;
  - the signed-out variant;
  - no price text appears.

## Phase 5 — Share / export (reviewer required for the web link)

> Detailed on 2026-10-12 after measuring the heritg.us "Bagikan / Ekspor silsilah" panel. The measurements are in the reference, section "Bagikan / Ekspor, measured 2026-10-12".
> - Write our own copy. Tasks run sequentially, because they share `Workspace.tsx` and the share panel.
> - Every task ends with `npm test -- --run` and `npm run lint`. Tasks 5.5 and 5.6 also run `npm run test:api` and need the reviewer.
> - One commit per task.

**Shared decisions (the owner may override):**
- **The Bagikan button always works.** It opens a right `SidePanel` titled "Bagikan / Ekspor silsilah", including for local-only trees. Only "Bikin Link Web" needs a synced tree and a signed-in owner; otherwise that card explains why.
- **"Ekspor file" leaves the sidebar.** Export lives in this panel.
- **Privacy options** ("Yang bakal kelihatan"):
  - birth dates and birth order;
  - marriage dates;
  - profile photos.
  - Names, genders and relationships are always included. "Usia yang dihitung" is left out, since we do not show computed ages.
- **One link per tree,** as today. A link is either plain (as now) or password-protected. Both can carry an expiry: never, 7, 30 or 90 days.

### Task 5.1 — Bagikan panel and backup card
**Files:**
- new `src/features/tree/panels/SharePanel.tsx` and its tests
- `Workspace.tsx`, `TreeSidebar.tsx` (remove "Ekspor file")
- i18n, `panels.module.css`

- [x] **Panel layout:**
  - A scope card shows the tree name and "Ada N orang di silsilah ini".
  - The heading is "Mau bagikan apa?".
  - A method picker holds four `aria-pressed` cards: Bikin Link Web, File Backup HERITG, File GEDCOM, Simpan Gambar. Each card has a 38 icon tile and a strong label with a small line under it.
  - Below the picker is a details card for the chosen method.
- [x] **Link Web card** (for now): the existing `PublishDialog` content, moved into the card.
  - It keeps its accessible names and tests.
  - It is shown only for a synced tree. Otherwise the card says "Link web butuh silsilah yang sudah online di akunmu" (or asks the owner to sign in).
- [x] **Backup card:**
  - It shows a "Paling disarankan" badge and a short explanation.
  - Its button is "Download .heritg". This is the existing `download` with embedded photos.
- [x] **GEDCOM and Gambar cards:** placeholders that say "Segera" until 5.2 and 5.3.
- [x] **Tests:**
  - the panel opens for a local-only tree;
  - the method switch works;
  - the backup download is called;
  - the link card is shown only when synced.

### Task 5.2 — GEDCOM 5.5.1 export and import
**Files:**
- new `src/features/tree/domain/gedcom.ts` and `gedcom.test.ts`
- `SharePanel.tsx`
- the import path in `Workspace.tsx` (`loadFile` accepts `.ged`)
- i18n

- [x] **Export:**
  - `HEAD` with `GEDC VERS 5.5.1`, `CHAR UTF-8` and `SOUR HERITG`;
  - each `INDI` with `NAME`, `SEX`, `BIRT/DATE`, `DEAT/DATE` and `NOTE`; residence goes to `RESI/PLAC`;
  - each `FAM` with `HUSB`/`WIFE` (or two partners by gender), `CHIL`, and `MARR/DATE`; an ex-partner gets `DIV`;
  - for a non-biological parent, the child's `FAMC` carries `PEDI` (adopted, foster, step); guardian maps to `PEDI foster` with a `NOTE`;
  - dates in GEDCOM form (`21 JUN 1961`);
  - CRLF line endings, and long text split with `CONC`/`CONT`.
- [x] **Privacy options** apply: birth dates and order, and marriage dates. Photos are never included.
- [x] **Import:**
  - read the same subset, ignore unknown tags, and accept partial dates (`JUN 1961`, `1961`);
  - map `PEDI` back to the parent kind;
  - build a new `FamilyTree` with new ids;
  - reject non-GEDCOM files with a clear error.
- [x] **Round-trip test:** the example tree survives export → import with the same people, relationships, kinds and dates (ids aside).
- [x] **Card:** a "Buat di aplikasi lain" badge, the privacy options, and "Download GEDCOM".

### Task 5.3 — Simpan Gambar (PNG and SVG)
**Files:**
- new `src/features/tree/canvas/exportImage.ts` and its tests
- `SharePanel.tsx`, i18n

- [x] **SVG:**
  - Render the current layout (the active view) through `TreeCanvas` to static markup, with no buttons or action dots, as the public viewer does.
  - Inline the needed CSS variables as literal colours, so the file stands alone.
  - Embed photos as data URLs: server photos are fetched with credentials. Drop photos when the option is off.
  - Use the font stack with a system fallback.
- [x] **PNG:**
  - Draw the SVG to an offscreen canvas at 2× ("PNG HD"), with a cap of 8000 px on the long side.
  - Use `toBlob` and download the result.
- [x] **Privacy options:** dates and photos.
- [x] **Card text:** say plainly that image files are not protected.
- [x] **Tests:**
  - the SVG string has no `<button`, includes the names, and drops dates and photos when unchecked;
  - unit-test the PNG size calculation.

### Task 5.4 — Password for the backup file
**Files:**
- new `src/features/tree/domain/secureFile.ts` (Web Crypto) and its tests
- `model.ts` import (detect an encrypted file)
- `SharePanel.tsx`, `Workspace.tsx` (a password prompt `Dialog` on import), i18n

- [ ] **Format:**
  - `{ "format": "heritg-encrypted", "version": 1, "kdf": { "name": "PBKDF2", "hash": "SHA-256", "iterations": 600000, "salt": b64 }, "cipher": { "name": "AES-GCM", "iv": b64 }, "data": b64 }`;
  - the plaintext is the normal `.heritg` JSON.
- [ ] **Password field:** optional, and it uses the same rules as the web link (5.6). Empty means a normal file.
- [ ] **Import:** prompt for the password. A wrong password shows "Password salah" and changes nothing.
- [ ] **Tests:** round-trip, a wrong password, a tampered ciphertext failing, and an unencrypted file still importing.

### Task 5.5 — Link privacy options and expiry (server; reviewer required)
**Files:**
- `src/server/db/schema.ts` plus a new drizzle migration
- `src/server/publications/{service,handlers}.ts`
- `src/app/api/trees/[id]/publication`, `src/app/api/public/**`
- `tests/api/publications.test.ts`
- the client `HttpPublicationRepository`, the publishing UI, i18n

- [ ] **Schema:** `publications` gains:
  - `options jsonb not null default '{}'` (`{ dates, marriageDates, photos }`, all booleans, default true);
  - `expires_at timestamptz null`.
- [ ] **Publish and update** accept `{ options, expiresInDays: 7 | 30 | 90 | null }`.
- [ ] **Snapshot:** the server builds the snapshot honouring the options:
  - blank `birthDate`/`deathDate`/`birthOrder` when dates are off;
  - blank `marriedOn` when marriage dates are off;
  - no `public_photos` and blank photo fields when photos are off.
  - Zod validates the options.
- [ ] **Public reads:**
  - An expired link returns the same 404 as an unknown one, for both the tree and its photos.
  - The response sets `Cache-Control: no-store`, as now.
- [ ] **API tests:** each option strips its fields; expiry turns into a 404, including for photos; invalid options give a 400; another owner gets a 404.
- [ ] **UI:**
  - The Link Web card gets the "Yang bakal kelihatan di link" `<details>`, holding three checkboxes and a short note.
  - It also gets an expiry select (Tanpa batas / 7 / 30 / 90 hari) and shows "Berlaku sampai <tanggal>".
- [ ] **Reviewer (Opus 5.5).**

### Task 5.6 — Password-protected link (server, client crypto and viewer; reviewer required)
**Files:**
- schema plus migration
- the publications service and handlers
- public routes
- `secureFile.ts` (reuse the crypto)
- the Link Web card
- `src/app/tree/[publicId]/PublicTree.tsx` (a password prompt)
- `tests/api`, i18n

- [ ] **Schema:** `publications` gains:
  - `encrypted boolean not null default false`;
  - `ciphertext text null`, a base64 string limited to 3 MB;
  - `crypto jsonb null` (kdf and iv, validated).
  - A CHECK requires that encrypted rows have a ciphertext and an empty snapshot, and that plain rows have no ciphertext.
- [ ] **The owner's client:**
  - It builds the filtered snapshot locally, with the same options as 5.5. Photos are embedded as data URLs, and the whole payload is capped.
  - It encrypts with PBKDF2-SHA-256 (600k iterations) → AES-GCM 256.
  - It uploads only the ciphertext and the crypto parameters: `PUT /api/trees/:id/publication` with `{ mode: "password", ... }`.
  - The server never sees the password or the plaintext. There are no `public_photos` rows.
- [ ] **Password rules:** at least 8 characters, with lower case, upper case, a digit and a symbol. A live checklist shows them, and a confirmation field must match.
  - Copy: "Kirim link dan password lewat jalur terpisah. Password yang lupa nggak bisa dipulihkan."
- [ ] **Public read:**
  - It returns `{ encrypted: true, name, crypto, ciphertext }`.
  - Expiry and the noindex/no-store headers work as in 5.5.
  - The name stays visible; the owner is told this ("Nama silsilah tetap kelihatan sebelum password diisi").
- [ ] **Viewer:**
  - It shows a password form (read-only page, no "edit" wording), decrypts in the browser, then renders as now.
  - A wrong password gives a neutral error.
  - **Accepted test exception:** the form's submit is the only button on the public page. `PublicTree.test.tsx` is updated to allow exactly that one, while still forbidding edit wording and any other buttons.
- [ ] **Tests:**
  - API: the encrypted publish stores no plaintext; the CHECK constraints; size limits; another owner gets a 404; expiry.
  - Client: an encrypt/decrypt round-trip, a wrong password, and that the viewer prompt never posts the password anywhere.
- [ ] **Reviewer (Opus 5.5).**

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
