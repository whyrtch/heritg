# Heritg × heritg.us Parity Design

## Objective

Make this app look, read and behave like https://heritg.us across the whole product (owner decision 2026-10-11: "klon penuh"), while **keeping the existing Firebase owner login and Firestore online sync** (owner decision, same day). This supersedes the Mori & Tarum visual direction (`2026-10-11-mori-tarum-visual-redesign-design.md`). Its functional fixes (Firestore Rules compatibility, read-only example tree, direct upload of new trees, public canvas sizing) stay.

> **Changed 2026-10-11 (owner):** "jangan pakai firebase, tapi buat backend saja". The Firebase/Firestore decisions in this document are superseded by `2026-10-11-own-backend-design.md` (Next.js API + PostgreSQL + own auth). The UI parity goals are unchanged.

Measured reference: `docs/superpowers/specs/2026-10-11-heritg-us-reference.md`. Re-implement from those measurements; do not copy heritg.us source code or assets (logo artwork included — draw our own flower mark in the same spirit).

## What heritg.us is (summary of the reference)

- A pannable SVG family canvas with circular, gender-tinted nodes, kinship labels relative to the selected person, and two action dots (edit / add).
- Three views: **Fokus** (selected + parents + partners + children, optional siblings), **Lengkap** (whole tree) and **Kipas** (fan chart page).
- A 3-step **add-relative wizard** (new vs. link existing → 20+ relationship statuses → profile), an **edit profile** dialog with a family-relations editor, and first-run **coach marks**.
- Side panels: tree list sidebar, Semua orang, Setelan (Family+, account, app language, kinship-term dialect), Bagikan / Ekspor, Bantuan, Perlindungan privasi.
- Exports: `.heritg` backup, GEDCOM, PNG/SVG image, password-protected web link.
- Indonesian casual copy by default; English and Malay available; kinship terms in several dialects (Indonesian, Javanese, Malay, English).

## Architecture decisions (where heritg.us and our stack differ)

| heritg.us | This app (decision) |
|---|---|
| Local-first, AES-GCM in browser, no account | Keep Firebase Auth owner login + Firestore as source of truth with the existing offline cache. The "Perlindungan privasi" panel describes *our* model honestly (owner-only Firestore Rules, private by default, offline cache on this device). |
| Family+ subscription = cross-device encrypted sync | Our online sync already does this. Family+ dialog/menu is reproduced visually; its CTA explains that online sync is included with the owner account. No payments. |
| Optional account in Settings | "Akun" section shows the signed-in owner and Sign out (and Sign in when signed out). |
| Password-protected, encrypted share link | Extend publishing: the public snapshot is encrypted client-side (AES-GCM, key from PBKDF2(password, salt)) before upload; the viewer page asks for the password and decrypts in the browser. Unlisted-without-password stays available as an option. Needs a Rules + schema change and security review. |
| Photo upload stored locally | Firestore Spark plan, no Storage: accept uploads but resize/compress client-side to a small WebP/JPEG (≤ 256 px, ≤ 48 KB) and store it in `trees/{treeId}/photos/{personId}` (owner-only, size-checked in Rules). HTTPS photo URLs keep working. |
| Data model: single name, gender, birth order, residence, many relationship kinds | Adopt it (schema v2, below) with a deterministic migration from v1. |

## Data model v2

Person:
- `name`: single field.
- `gender`: `"male" | "female" | "unspecified"`.
- `birthDate` and `deathDate`: `YYYY-MM-DD` or `""`.
- `birthOrder`: integer or `null`.
- `residence`: string.
- `notes`: string.
- `photo`: `{ kind: "url", url } | { kind: "inline" } | null`.

Relationship:
- `type`: `"parent-child" | "partner"`.
- For parent-child, `kind`: `"biological" | "step" | "adoptive" | "foster" | "guardian"`.
- For partner, `status`: `"married" | "partner" | "ex"`, plus `marriedOn` (`YYYY-MM-DD` or `""`).

The wizard's 20+ statuses are views over these fields plus genders. For example, "Ibu tiri" = parent-child (kind `step`), parent female; "Mantan suami" = partner (status `ex`), partner male.

Migration v1 → v2:
- `name = trim(firstName + " " + lastName)`.
- `gender`: `nonbinary` maps to `unspecified`.
- Relationships default to `biological` / `married`.
- Existing Firestore trees migrate lazily on first load by the owner (revision-checked save). Local caches migrate on read.
- `.heritg` import accepts v1 and v2.

## Kinship engine

A pure module computes the label of any person relative to the selected person from the graph:
- parents, grandparents and great-grandparents;
- children and grandchildren;
- siblings and half-siblings;
- uncles/aunts, nieces/nephews, cousins;
- in-laws and spouses;
- step, adoptive and foster variants.

Labels come from a term table per dialect (`id`, `jv-yogya`, `ms`, `en`) and gender. It is unit-tested against a fixture family.

## Views

- **Fokus**: selected person centered, plus:
  - parents (with "Leluhur lainnya" to add generations);
  - partners;
  - children (with "Keturunan lainnya");
  - siblings when "Tampilkan saudara" is checked.
- **Lengkap**: generational layout of everyone, 260 px grid, orthogonal bus connectors, partner lines in `#b47c76`, and a "Hubungan" legend chip.
- **Kipas**: separate in-app page with a semicircle fan of ancestors and a lower half of children. Controls: Generasi (2–5) and Ukuran bagan. Empty slots read "Belum tercatat", and tapping a person re-roots the fan.

## Out of scope / deferred

- Real payments for Family+.
- Telegram/WhatsApp bug-report backend: "Laporin bug" opens prefilled links.
- PDF export: heritg.us lists it in Family+ copy. PNG and SVG are in scope; PDF is deferred.

## Acceptance

- Side-by-side screenshots against heritg.us match within a few pixels for:
  - empty state with coach marks;
  - Fokus and Lengkap trees;
  - every dialog and panel listed in the reference, at desktop (≥ 900 px) and mobile (390 px).
- Copy matches the Indonesian reference. English and Malay exist for every string.
- All existing security properties hold. New Rules (schema v2, photos, encrypted publications) are covered by emulator tests and reviewed by `reviewer`.
- `npm test -- --run`, `npm run lint`, `npm run build` and `npm run test:rules` pass.
