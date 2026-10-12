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

- [x] **Format:**
  - `{ "format": "heritg-encrypted", "version": 1, "kdf": { "name": "PBKDF2", "hash": "SHA-256", "iterations": 600000, "salt": b64 }, "cipher": { "name": "AES-GCM", "iv": b64 }, "data": b64 }`;
  - the plaintext is the normal `.heritg` JSON.
- [x] **Password field:** optional, and it uses the same rules as the web link (5.6). Empty means a normal file.
- [x] **Import:** prompt for the password. A wrong password shows "Password salah" and changes nothing.
- [x] **Tests:** round-trip, a wrong password, a tampered ciphertext failing, and an unencrypted file still importing.

### Task 5.5 — Link privacy options and expiry (server; reviewer required)
**Files:**
- `src/server/db/schema.ts` plus a new drizzle migration
- `src/server/publications/{service,handlers}.ts`
- `src/app/api/trees/[id]/publication`, `src/app/api/public/**`
- `tests/api/publications.test.ts`
- the client `HttpPublicationRepository`, the publishing UI, i18n

- [x] **Schema:** `publications` gains:
  - `options jsonb not null default '{}'` (`{ dates, marriageDates, photos }`, all booleans, default true);
  - `expires_at timestamptz null`.
- [x] **Publish and update** accept `{ options, expiresInDays: 7 | 30 | 90 | null }`.
- [x] **Snapshot:** the server builds the snapshot honouring the options:
  - blank `birthDate`/`deathDate`/`birthOrder` when dates are off;
  - blank `marriedOn` when marriage dates are off;
  - no `public_photos` and blank photo fields when photos are off.
  - Zod validates the options.
- [x] **Public reads:**
  - An expired link returns the same 404 as an unknown one, for both the tree and its photos.
  - The response sets `Cache-Control: no-store`, as now.
- [x] **API tests:** each option strips its fields; expiry turns into a 404, including for photos; invalid options give a 400; another owner gets a 404.
- [x] **UI:**
  - The Link Web card gets the "Yang bakal kelihatan di link" `<details>`, holding three checkboxes and a short note.
  - It also gets an expiry select (Tanpa batas / 7 / 30 / 90 hari) and shows "Berlaku sampai <tanggal>".
- [x] **Reviewer (Opus 5.5).** Approved after three rounds.
- _Fixed during review:_
  - _A field the owner did not send keeps its stored value, for options and expiry alike, and also across a regenerate._
  - _Update and regenerate wait until the stored settings have loaded._
  - _The "Tidak diubah" choice keeps the stored expiry._

### Task 5.6 — Password-protected link (server, client crypto and viewer; reviewer required)
**Files:**
- schema plus migration
- the publications service and handlers
- public routes
- `secureFile.ts` (reuse the crypto)
- the Link Web card
- `src/app/tree/[publicId]/PublicTree.tsx` (a password prompt)
- `tests/api`, i18n

- [x] **Schema:** `publications` gains:
  - `encrypted boolean not null default false`;
  - `ciphertext text null`, a base64 string limited to 4,000,000 characters (the request body limit for this route is about 4.5 MB);
  - `crypto jsonb null` (kdf and iv, validated).
  - A CHECK requires that encrypted rows have a ciphertext and an empty snapshot, and that plain rows have no ciphertext.
- [x] **The owner's client:**
  - It builds the filtered snapshot locally, with the same options as 5.5. Photos are embedded as data URLs, and the whole payload is capped.
  - It encrypts with PBKDF2-SHA-256 (600k iterations) → AES-GCM 256.
  - It uploads only the ciphertext and the crypto parameters: `PUT /api/trees/:id/publication` with `{ mode: "password", ... }`.
  - The server never sees the password or the plaintext. There are no `public_photos` rows.
- [x] **Password rules:** at least 8 characters, with lower case, upper case, a digit and a symbol. A live checklist shows them, and a confirmation field must match.
  - Copy: "Kirim link dan password lewat jalur terpisah. Password yang lupa nggak bisa dipulihkan."
- [x] **Public read:**
  - It returns `{ encrypted: true, name, envelope }`, where the envelope is the stored crypto parameters plus `data` (the ciphertext).
  - Expiry and the noindex/no-store headers work as in 5.5.
  - The name stays visible; the owner is told this ("Nama silsilah tetap kelihatan sebelum password diisi").
- [x] **Viewer:**
  - It shows a password form (read-only page, no "edit" wording), decrypts in the browser, then renders as now.
  - A wrong password gives a neutral error.
  - **Accepted test exception:** the form's submit is the only button on the public page. `PublicTree.test.tsx` is updated to allow exactly that one, while still forbidding edit wording and any other buttons.
- [x] **Tests:**
  - API: the encrypted publish stores no plaintext; the CHECK constraints; size limits; another owner gets a 404; expiry.
  - Client: an encrypt/decrypt round-trip, a wrong password, and that the viewer prompt never posts the password anywhere.
- [x] **Reviewer (Opus 5.5).** Approved after two rounds.
- _Fixed during review:_ _a protected link that reuses its ciphertext keeps its stored options and published version; changing options needs a new envelope (409 otherwise)._

## Phase 6 — Kipas (fan chart)

> Detailed on 2026-10-13 after measuring the heritg.us Kipas view (reference section "Kipas, measured 2026-10-13").
> - The two tasks run sequentially.
> - Each task ends with `npm test -- --run` and `npm run lint`, and is one commit.
> - Copy is in our own words.

### Task 6.1 — Fan layout (pure)
**Files:** new `src/features/tree/canvas/fanLayout.ts` and `fanLayout.test.ts`.

- [x] **`layoutFan(tree, rootId, generations: 1..5)`** returns `{ viewBox, root, ancestors: FanSegment[], children: FanSegment[] }`.
  - The centre is (cx, cy). The root circle has r 52, with text clipped to r 48.
  - Ancestor ring g (g ≥ 1) has inner radius `72 + (g-1)*80` and outer `inner + 78`. It spans the upper half (180° → 360°), split into 2^g equal slots.
  - Slot i of ring g is the parent of slot ⌊i/2⌋ of ring g-1. The first parent slot is the father side: a male parent, else the first parent by relationship order. The second slot is the other parent.
  - With more than two parents (biological plus step or adoptive), use the two biological parents. If there are none, use the first two.
- [x] **Placeholders:**
  - A missing parent of a *known* person becomes a `placeholder: true` segment ("Belum tercatat").
  - Slots above a placeholder are not drawn.
  - Rings beyond the requested generations are not drawn.
- [x] **Children:** the lower half (0° → 180°) holds one ring at radii 72–150, split equally among the root's children (all parent kinds), ordered by birth order, then birth date, then name.
- [x] **Each segment** carries:
  - an SVG path (an annular sector: outer arc, line, inner arc, close);
  - a label anchor point and a rotation that keeps text upright and readable (flip text that would be upside down);
  - `personId | null`, `generation`, and the gender for the fill;
  - a `relation` used in the accessible label: "Orang tua dari X", "Kakek/nenek…", or "Anak dari X".
- [x] **viewBox:**
  - It is computed from the outermost drawn radius plus a 6-unit margin.
  - Its height is only the top half plus the root when there are no children, or the full circle extent when there are children.
- [x] **Tests:**
  - the example tree from Joko Widodo with 3 generations gives the right ancestors in the right slots;
  - placeholders appear only for missing parents of known people;
  - no slots appear above a placeholder;
  - the children's count and order;
  - the generation cap;
  - the path strings are well-formed (no NaN);
  - text rotation stays within -90..90.

### Task 6.2 — Kipas page in the workspace
**Files:**
- new `src/features/tree/canvas/FanView.tsx`, `fanView.module.css` and their tests;
- `Workspace.tsx` (view `"fan"`, enabling the segmented button);
- i18n.

- [x] **Layout.** When the view is `"fan"`, the canvas area shows a scrollable page instead of the tree stage. It is centred, max width 1120, padding 16/32/48. The top bar, controls and bottom-left chips stay; the zoom and fit buttons are hidden in this view.
- [x] **Navigation.**
  - A "Kembali" secondary button (ArrowLeft) walks back through the people previously explored; it is disabled when there is no history.
  - A text button "Kembali ke pohon" switches back to the previous tree view.
- [x] **Heading.** "Kipas" (24/700), with an explanation line in our own words.
- [x] **Controls.**
  - Generasi is a select of 1–5, default 3.
  - Ukuran bagan has three choices: Sesuaikan layar (fit width), 150% and 200%. The chart sits in a scroll region labelled "Orang tua dan anak".
- [x] **Chart.**
  - The root fill comes from the gender tokens (`--male-fill` etc.), with stroke `--brand-deep` 4.
  - Known segments are filled by gender with stroke `--line` 1.5. Placeholders use `--base` with a muted label.
  - Name text is 12/500 on rings and 16/500 in the root, wrapped to two lines and clipped.
- [x] **Interaction.**
  - Known segments are `role="button"` with `tabindex=0`, and Enter or Space activates them.
  - Each has an `aria-label` of "<nama> · <relasi>" and a `<title>`.
  - Clicking or activating a segment re-roots on that person and pushes the previous root to the history.
  - Placeholders are not interactive.
- [x] **Under the chart.**
  - A status line: "Anak belum tercatat" when the root has no children; otherwise "N anak".
  - A selection row for the current person: avatar, name, life dates. When the tree is not read-only it also has "Tambah kerabat" (+) and "Edit profil" (pencil) buttons, which open the existing wizard and editor.
  - Two short notes: how to explore, and that only parent–child links are shown (partners and siblings are not).
- [x] **Starting person.** The initial root is the selected person, else the Fokus root, else the first person. Leaving the fan view keeps the selection.
- [x] **Public viewer.** It is not changed in this phase.
- [x] **Tests:**
  - switching to Kipas renders the heading and the root;
  - clicking a parent segment re-roots, and Kembali returns;
  - the generations select changes the ring count;
  - the read-only example tree has no add or edit buttons;
  - keyboard activation works.

## Phase 7 — Mobile parity, polish, verification

> Detailed on 2026-10-13 after measuring heritg.us at 375 px (reference "Mobile, measured 2026-10-13") and checking our app in the browser.
> - The tasks run sequentially: 7.1–7.3 touch shared CSS and `Workspace.tsx`.
> - Each implementation task ends with `npm test -- --run` and `npm run lint`, and is one commit.

### Task 7.1 — Mobile layout (< 600 px)
**Files:** `workspace.module.css`, `panels.module.css`, `dialogs/dialogs.module.css`, `canvas/fanView.module.css`, `Workspace.tsx` (only if markup is needed), and tests where behaviour changes.

- [x] **Chrome**, following the reference "Mobile (375x812)":
  - insets 10–12;
  - the title card at 64,10, 44 high, with the name ellipsized;
  - Family+, Bagikan and Setelan as round 44 icon-only buttons, keeping their accessible names;
  - the controls column at right 12 / bottom 12 with gap 8;
  - the privacy chip as a round 44 icon-only button next to Bantuan;
  - the eye button and the view chip at the bottom left.
- [x] **Side panels:** fixed to the right, `width: calc(100% - 46px)`, full height.
- [x] **Sidebar:** 304 wide.
- [x] **Dialogs** (the `Dialog` shell, the conflict dialog, the unlock dialog): full screen, with radius 22 22 0 0, a sticky header and footer, and a scrolling body.
- [x] **Kipas page:** content starts below the top bar (top 76) with padding 12 12 64. On desktop it also gets enough bottom padding (≥ 96) that the bottom-left and bottom-right chips never cover the selection row or the notes. The right controls column is hidden in fan view on mobile, as on heritg.us.
- [x] **Tests:** keep the existing accessible names. Add a test that the icon-only buttons still have their names.

### Task 7.2 — Polish and leftover English
**Files:** `Workspace.tsx`, `model.ts` (date formatting helpers), `canvas/FanView.tsx`, `canvas/fanLayout.ts`, the components listed below, i18n, and tests.

- [x] **Leftover English** goes into the i18n catalog (id/en/ms), with tests updated in the same commit:
  - the read-only `PersonPanel` ("Born", "Parents", "Partner", "Children", "Example tree", "Start your own tree", "Edit details", "Add a relative", "Delete person");
  - `ConflictDialog`;
  - `MigrationDialog`;
  - `SyncStatus`;
  - `RequireOwner`;
  - the login page;
  - the public viewer.
  - Keep accessible names in sync with their tests.
- [x] **Localized life dates:** `lifeDatesLong` and similar helpers take the language ("Lahir 21 Juni 1961", "Born 21 June 1961", "Lahir 21 Jun 1961").
- [x] **Kipas fixes:**
  - "Belum tercatat" placeholders on the outer rings show a short label, or "?", when the full text does not fit, with the full text in `<title>`;
  - picking a view in the view popover closes the popover;
  - in fan view, choosing someone never opens the example tree's person panel over the page.
- [x] **"Jumlah turunan cabang":** it stays disabled, with a clear tooltip "Segera hadir". Measuring it needs a large sample tree on heritg.us; that is a follow-up.

### Task 7.3 — Reduced motion, keyboard and contrast
**Files:** `globals.css`, the module CSS files, components as needed, and tests.

- [x] **Reduced motion:** with `@media (prefers-reduced-motion: reduce)`, turn off the slide and fade animations and the canvas transform transition.
- [x] **Keyboard:**
  - every dialog and panel closes on Escape and returns focus to the control that opened it;
  - the sidebar and kebab menus are reachable;
  - fan segments are focusable;
  - no focus trap leaks.
  - Add tests for focus return on the side panels and the sidebar.
- [x] **Contrast:** check text and token pairs against WCAG AA, i.e. 4.5:1 for body text and 3:1 for large text and UI glyphs. Darken only the tokens that fail, document the change in globals.css, and stay in the Mori & Tarum / heritg.us palette.

### Task 7.4 — Side-by-side review and full verification (main session)
- [x] **Screens to compare** with heritg.us at desktop and 375 px:
  - the main screen;
  - the sidebar;
  - each panel;
  - each dialog;
  - Bagikan;
  - Kipas;
  - the public viewer.
- [x] **Fixes:** fix small differences inline; send larger ones back to the planner.
- [x] **Full verification:** `npm test -- --run`, `npm run test:api`, `npm run lint` and `npm run build`.
- _Done on 2026-10-13 in the browser against a temporary local PostgreSQL, at desktop and 375 px. Checked: the main screen, sidebar, panels, Family+, Bagikan, Kipas, and the public viewer, both plain and password-protected (wrong and right password). The viewer has zero buttons after unlock and is noindex. Verification: 367 unit tests, 96 API tests, lint and build all pass._
- _Note: run `npm run build` only while no dev server is running. Both write `.next`, and a dev server left running ends up with a broken cache ("Cannot find module vendor-chunks")._

### Task 7.5 — Docs
- [ ] **README:** features (panels, export formats, password links, Kipas), the UI languages, and the deployment note on body size.
- [ ] **AGENTS.md:**
  - the UI language rule (Indonesian default; every string in the i18n catalog for id/en/ms);
  - the layout of `src/features/tree/panels/`;
  - the public-page exception for the password prompt;
  - the export formats.
- [ ] **Figma:** optional, only if the MCP quota allows. Skip otherwise and say so.

## Self-review

- Every heritg.us feature in the reference maps to a phase. Architecture conflicts are resolved in the spec, not left to implementers.
- Phases 0, 2, 3 and 4 are presentation and logic without Rules changes, so they can start before Phase 1 is reviewed. Phase 2's relationship statuses do depend on Phase 1's model, so Phase 1 must merge before Phase 3's wizard step 2.
- The riskiest pieces, schema v2 Rules and the encrypted web link, are isolated in their own phases with mandatory review and emulator tests.
