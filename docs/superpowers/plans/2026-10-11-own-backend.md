# Plan: own backend (Next.js API + PostgreSQL) instead of Firebase

Spec: `docs/superpowers/specs/2026-10-11-own-backend-design.md`. Branch: `feat/heritg-us-parity`, or a new `feat/own-backend` branched from it; the owner decides when approving.

**Ordering**
- This plan runs **before** parity phases 4–7 (`2026-10-11-heritg-us-parity.md`).
- Phase 3's PhotoPicker upload moves here (B5).
- Phase 5 (share/export) is built on the new API.

**Every phase**
- Must pass `npm test -- --run`, `npm run lint`, `npx tsc --noEmit`, and (from B1) `npm run test:api`.
- `npm run build` must pass before the branch is ready.
- Phases B2–B7 touch auth, authorization and persistence, so **reviewer (Opus 5.5) is mandatory** for each.
- One phase = one commit or a small series. No deploys.

## Global constraints

- Server code lives only in `src/server/**` and `src/app/api/**`, and is never imported from `"use client"` files. Add an ESLint `no-restricted-imports` rule for `@/server/*` in client code.
- Every tree query takes the session user id. There is no "load by id" without an owner, except the public snapshot service.
- Keep the client interfaces `TreeRepository` and `PublicationRepository` and the `OnlineTree` shape. Their behavior must not change for `useTreeSync`, `LocalTreeCache` or the migration dialog.
- Keep the accessible names that tests assert. Indonesian copy stays the default.
- Keep `.heritg` import and export compatible (versions 1 and 2).

## B1 — Database foundation

**Files**
- `src/server/db/{schema.ts,client.ts,migrate.ts}`
- `drizzle.config.ts`, `drizzle/` (generated SQL)
- `tests/api/db.ts` (PGlite harness)
- `docker-compose.yml`
- `.env.example` (only `DATABASE_URL=` placeholder)
- `package.json` scripts

**Tasks**
- [x] Add `drizzle-orm`, `postgres`, `drizzle-kit`, `@electric-sql/pglite` and `zod`.
- [x] Write the schema from the spec: tables, FKs with cascade, CHECK constraints mirroring the v2 Rules, and indexes on `trees(owner_id)` and `sessions(expires_at)`. Generate the first migration.
- [x] `client.ts`: a lazy singleton reading `DATABASE_URL`, server-only (`import "server-only"`).
- [x] Test harness: `createTestDb()` spins up a PGlite instance with the migrations applied. Add `npm run test:api` (Vitest config `vitest.api.config.ts`, node environment).
- [x] Add `npm run db:migrate` and `npm run db:generate`, plus `docker-compose.yml` with Postgres 16 for local dev.
- [x] Tests: the schema rejects invalid rows (gender, birth order, a partner with a kind, a relationship into another tree, a photo over 48 KB).

- _Notes: CHECKs say `is not null` explicitly, because `NULL in (...)` would pass a CHECK. Emails are stored lowercase with a unique index (no citext extension). `.env.example` was not changed, per the owner's earlier instruction; `DATABASE_URL` is documented in docker-compose.yml and goes into the README in B7. The migration was verified on PGlite (Postgres 17 WASM); Docker Desktop was not running, so it was not run against Postgres 16._

## B2 — Auth (replaces Firebase Auth)

**Files**
- `src/server/auth/{password.ts,session.ts,rateLimit.ts,guard.ts}`
- `src/app/api/auth/{login,logout,session,password}/route.ts`
- `scripts/owner-create.ts`, `scripts/owner-reset-password.ts`
- `src/features/auth/{AuthProvider.tsx,useAuth.ts,RequireOwner.tsx,OwnerSession.tsx,authErrors.ts}`
- `src/app/login/page.tsx`

**Tasks**
- [x] Argon2id hashing (`@node-rs/argon2`), with a dummy-hash path for unknown emails.
- [x] Sessions:
  - random 32-byte token, SHA-256 stored;
  - `__Host-` cookie (HttpOnly, Secure, SameSite=Lax);
  - 30-day sliding expiry, `last_seen_at` throttled to once per hour;
  - expired sessions purged on login.
- [x] `requireOwner(request)`: reads the cookie, loads the session and user, and checks Origin/Host on mutating methods.
- [x] Rate limit: 5 failures per 15 minutes per email and 20 per IP, through `login_attempts`.
- [x] Routes:
  - `login`: neutral error, rotates the session;
  - `logout`;
  - `session`;
  - `password`: change it and revoke the other sessions.
- [x] Owner CLI scripts: create the owner and reset the password, with an interactive password prompt. Document them in the README.
- [x] Client:
  - `AuthProvider` uses `GET /api/auth/session`;
  - `signIn` and `signOut` call the API;
  - `useAuth` keeps its shape (`user`, `status`, `signOut`), so `Workspace`, `RequireOwner` and `OwnerSession` change minimally.
- [x] Login page: same UI. "Lupa password?" now shows help text ("Minta pemilik arsip menjalankan reset password"), since there is no email service.
- [x] Tests:
  - login success, wrong password and unknown email (identical response);
  - rate limit;
  - cookie flags;
  - session expiry;
  - logout revocation;
  - password change revoking other sessions;
  - a cross-origin POST rejected;
  - the client auth components with a mocked fetch.
- _Review (Opus 5.5) changed the rate limiting:_
  - _Attempts are recorded before the password is checked, so parallel guesses count._
  - _The block applies per address+account and per address. The address is trusted only through `TRUSTED_PROXY_HOPS`._
  - _An account is never locked; instead its attempts are spaced 1–10 s apart (about 90 per 15 min)._
  - _Argon2 hashing runs in a bounded pool._
  - _Bodies are read with a streaming limit._
  - _`/session` re-sends the cookie, and sessions have a 90-day absolute cap._
  - _`APP_URL` is required in production; without it, every POST is refused._
- [ ] Follow-up (from review): an attacker who keeps sending attempts to the owner's email holds the account spacing open, so the owner gets 429 while the attack lasts. Fix: a signed "known device" cookie on successful login that skips account spacing, and measure the gap only against attempts that were let through.

## B3 — Trees API + HttpTreeRepository

**Files**
- `src/server/trees/{service.ts,validation.ts}`
- `src/app/api/trees/route.ts`, `src/app/api/trees/[id]/route.ts`
- `src/features/tree/repository/HttpTreeRepository.ts`
- `src/features/tree/Workspace.tsx` (repository wiring)
- `src/features/tree/repository/FirestoreTreeRepository.ts` (deleted in B7)

**Tasks**
- [x] Zod schemas for `OnlineTree` v2, reusing the domain limits (`NAME_MAX`, `RESIDENCE_MAX`, `BIRTH_ORDER_MAX`, ISO dates, HTTPS photo URLs).
- [x] Service functions, all scoped by `ownerId`:
  - `listOwned`;
  - `load`;
  - `create`: a conflict when this owner already has the id, not-found when another owner has it;
  - `save`: a SERIALIZABLE transaction with a revision check, diffing people and relationships, and a 409 that returns the current tree;
  - `delete`.
- [x] Routes map service errors onto the `TreeRepositoryError` codes the client already understands. These are `conflict`, `not-found`, `permission-denied`, `offline` and `invalid-data`.
- [x] `HttpTreeRepository` implements `TreeRepository` with `fetch` and credentials. A network failure maps to `offline` (the sync queue keeps the edit).
- [x] `Workspace`: build `HttpTreeRepository` instead of `FirestoreTreeRepository` when signed in.
- [x] Tests (API, PGlite) — the old `tests/rules` coverage, re-expressed:
  - owner-only access, with another owner getting 404 and anonymous getting 401;
  - validation failures;
  - relationship endpoints confined to the same tree;
  - revision conflict;
  - a large tree (500 people) saved in one transaction;
  - a v1-shaped body rejected.
- [x] `useTreeSync` tests run against `HttpTreeRepository` with a mocked fetch.
- _Notes:_
  - _Text fields reject NUL characters. As a backstop, PostgreSQL data errors map to 400, so a missed rule never reads as "offline" and wedges the sync queue._
  - _Verified in the browser against an in-memory PGlite exposed through `@electric-sql/pglite-socket`: login, the import dialog, save (revision++), and the wizard adding a partner. That test server shares one PGlite session across connections, so use `DATABASE_POOL_MAX=1` with it. Real PostgreSQL is unaffected (confirmed in review)._
- [ ] Follow-up: imported `.heritg` files may carry ids outside `[A-Za-z0-9_-]{1,128}`. Re-map them in `importTree`/`planMigration`, or report them before upload.
- [ ] Follow-up: an expired session (401) only shows a sync error. Surface it to `AuthProvider` with a sign-in prompt; queued edits are kept and replay after sign-in.
- [ ] Follow-up (existing, more likely over HTTP): `useTreeSync` can run two saves in parallel. A later edit can then hit a 409 and be dropped when the earlier one is acknowledged. Allow one in-flight save per tree, chaining the persists.

## B4 — Publishing API + public page

**Files**
- `src/server/publications/service.ts`
- `src/app/api/trees/[id]/publication/route.ts`, `src/app/api/public/[publicId]/route.ts`
- `src/features/tree/publishing/HttpPublicationRepository.ts`, `loadPublicTree.ts`
- `src/app/tree/[publicId]/page.tsx`

**Tasks**
- [ ] Publish:
  - one transaction copies the people and relationships, without owner identity, into the `publications.snapshot` jsonb plus `public_photos`;
  - it sets the tree's `visibility`, `public_id` and `published_revision`;
  - republishing under a new id deletes the old row.
- [ ] Disable deletes the publication row (photos cascade) and makes the tree private, atomically. The `cleanupDisabled` interface method becomes a no-op.
- [ ] `GET /api/public/:publicId`:
  - enabled snapshot only, with an identical 404 for unknown and disabled links;
  - `X-Robots-Tag: noindex, nofollow`, `Cache-Control: no-store`.
- [ ] The public page loads through the API; `PublicTree` itself is unchanged.
- [ ] Tests:
  - anonymous read of an enabled snapshot;
  - a disabled or unknown link gives 404;
  - no owner email or id anywhere in the response;
  - only the owner can publish or disable;
  - a republish swaps the id.

## B5 — Photo upload

**Files**
- `src/server/photos/service.ts`
- `src/app/api/trees/[id]/people/[personId]/photo/route.ts`, `src/app/api/public/[publicId]/photos/[personId]/route.ts`
- `src/features/tree/domain/photoData.ts` (from the stash: client compression)
- `src/features/tree/dialogs/PhotoPicker.tsx`
- `model.ts` (`photoVersion`)
- sync wiring

**Tasks**
- [ ] Restore the client compression from `stash@{0}` (`compressPhoto`, `encodeWithinLimit`, tests): 256 px WebP/JPEG targeting at most 30 KB, hard limit 48 KB. Drop its Firestore parts.
- [ ] Server:
  - accept `image/jpeg` and `image/webp` only, checked by magic bytes and not only `Content-Type`;
  - at most 49,152 bytes;
  - store the bytes plus their sha256;
  - return `photoVersion`.
- [ ] Serve with `ETag` and `Cache-Control: private, max-age=31536000, immutable` (the URL carries `?v=photoVersion`). Public photos are served only while the link is enabled.
- [ ] `Person.photoVersion`:
  - `TreeCanvas`, avatars and the public page build `/api/.../photo?v=` URLs;
  - an offline-picked photo stays in `person.photo` (data URL) until the next sync uploads it, then is cleared locally;
  - HTTPS `photoUrl` links keep working.
- [ ] PhotoPicker:
  - "Pilih foto" opens a file chooser (`accept=image/jpeg,image/png,image/webp`), compresses, and previews;
  - "Pakai link" stays as a secondary option;
  - "Hapus foto".
- [ ] AGENTS.md: replace the "Photos are HTTPS URLs only; no uploads" hard rule with the approved thumbnail rule (owner, 2026-10-11).
- [ ] Tests: compression, type and size rejection (PNG body, SVG, oversize, a wrong magic number), owner-only reads, public photo only while enabled, cascade on person delete.

## B6 — Firestore → Postgres migration script

**Files**
- `scripts/migrate-from-firestore.ts`
- README section

**Tasks**
- [ ] `firebase-admin` as a temporary dev dependency. Inputs are `GOOGLE_APPLICATION_CREDENTIALS` (path to the owner's service-account JSON), `FIREBASE_OWNER_UID` and `OWNER_EMAIL`.
- [ ] Read the trees for that uid with their people, relationships and members, and read their publications. Normalize through `fromOnlineTree`/`toOnlineTree`, which already reads v1 and v2. Upsert for the owner user.
- [ ] `--dry-run` prints counts and validation problems. A real run is idempotent, and nothing in Firebase is modified.
- [ ] Re-create enabled publications under the same `publicId`.
- [ ] Tests: a fixture export (JSON) → PGlite gives the expected rows, and a rerun is a no-op.
- [ ] The owner runs it. I never run it against real data without explicit approval in chat.

## B7 — Remove Firebase

**Files**
- `src/lib/firebase/**`, `Firestore*Repository.ts`
- `firestore.rules`, `firebase.json`, `.firebaserc`, `tests/rules/**`, `vitest.rules.config.ts`
- `package.json`
- `README.md`, `AGENTS.md`, `CLAUDE.md`, `.env.example`

**Tasks**
- [ ] Delete the Firebase code, config and Rules tests. Remove `firebase`, `firebase-tools` and `@firebase/rules-unit-testing`. Replace the `test:rules` script with `test:api`.
- [ ] Update `AGENTS.md`:
  - stack;
  - commands;
  - the hard rules: "the security boundary is the server authorization layer + DB constraints; every tree query is scoped by owner; changes to `src/server/**` or `src/app/api/**` need API tests and a reviewer";
  - Postgres setup.
- [ ] Update the README: setup with Docker Postgres, `db:migrate`, `owner:create`, and the env vars.
- [ ] Final reviewer pass over the whole backend, then `npm run build`.

## After B7

Continue parity phases 4–7 on the new backend:
- Phase 4: panels.
- Phase 5: share/export. The password-protected link encrypts the snapshot client-side and stores the ciphertext in `publications`.
- Phase 6: Kipas.
- Phase 7: mobile/polish.
