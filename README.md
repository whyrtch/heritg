# Heritg

Heritg is a personal, online family-tree workspace. The owner signs in with Firebase Email/Password, edits normalized family data in Cloud Firestore, keeps an offline browser cache, and can publish an independently revocable unlisted link. Anyone with that link can view the published snapshot; only the owner can edit the private tree.

The app includes an editable `Keluarga Joko Widodo` demo spanning grandparents through grandchildren.

## Phase 2 features

- Owner-only email/password login; there is no public registration.
- Multiple family trees with relationships, cycle prevention, pan/zoom, search, import, and export.
- Firestore source of truth with optimistic saves, an offline queue, revision conflicts, and local `.heritg` backup recovery.
- Safe, resumable migration of legacy browser trees. Local source data is never deleted automatically.
- Photo URL input accepting only HTTPS links; no Firebase Storage or file upload is used.
- Per-tree unlisted publication, link copy/update, unpublish, and link regeneration.
- Anonymous public pages are read-only and marked `noindex, nofollow`.
- Firestore Rules deny global public listing and all anonymous writes.
- The schema reserves future member roles, but Phase 2 authorizes writes only for the owner.

## Local setup

Requirements: Node.js 20 or newer, Java 21 or newer for Firebase emulators, and npm.

```bash
cp .env.example .env.local
npm install
npm run dev
```

Open the URL printed by Next.js, normally [http://localhost:3000](http://localhost:3000).

The checked-in `.env.example` contains Firebase's public Web SDK identifiers for project `projects-8f743`. They are not server secrets; access control is enforced by Authentication and Firestore Security Rules. Keep actual secrets and local overrides out of Git.

To use local Firebase emulators, set `NEXT_PUBLIC_USE_FIREBASE_EMULATORS=true` in `.env.local`, then run:

```bash
npx -y firebase-tools@latest emulators:start --only auth,firestore
```

## Firebase Console setup

Before signing in against the real project:

1. Open Firebase Console → Authentication → Sign-in method.
2. Enable Email/Password.
3. Create the one owner account under Authentication → Users.
4. Do not add public sign-up; future editors will use owner-issued invitations.

Deploy reviewed Firestore configuration with:

```bash
npx -y firebase-tools@latest deploy --only firestore
```

This repository does not deploy automatically. Review `firestore.rules` before production deployment. The current Next.js public route is dynamically rendered, so choose a Next.js-compatible free host or adapt the app to static export before using the `hosting.public: out` Firebase Hosting configuration.

## Moving data from Firebase (one time)

Heritg is moving from Firebase to its own backend (Next.js API + PostgreSQL). See `docs/superpowers/plans/2026-10-11-own-backend.md`. To copy your existing online trees:

1. Create your account on the new backend: `npm run owner:create -- you@example.com`.
2. In the Firebase Console, open *Project settings → Service accounts* and generate a private key (a JSON file). Keep it outside the repository, and delete it when you are done.
3. Put these in `.env.local`:
   - `DATABASE_URL`
   - `OWNER_EMAIL` (the account from step 1)
   - `FIREBASE_OWNER_UID` (your user id under *Authentication → Users*)
   - `GOOGLE_APPLICATION_CREDENTIALS` (the path to that JSON file)
4. Try it first: `npm run migrate:firestore -- --dry-run`. This only reads and reports.
5. Import: `npm run migrate:firestore`. Add `--save-json backup.json` to keep a copy of what was read (`.gitignore` already excludes such files and service-account keys).

What the import does:
- Firebase is only read; nothing there is changed or deleted.
- Old (v1) trees are upgraded on the way.
- Shared links are re-created with the same address, showing exactly what was published.
- Re-running skips trees that already exist, so edits made on the new backend are kept. Use `--overwrite` to replace their content (a shared link already made on the new backend is kept). A link that could not be restored is reported (exit code 1) and is restored on the next run.
- `--from-json backup.json` imports a saved copy without contacting Firebase.

Trees that only ever lived in a browser are offered by the app's **Import family trees** prompt after you sign in.

## Verification

```bash
npm test -- --run
npm run test:rules
npm run lint
npm run build
```

`npm run test:rules` starts the Firestore emulator for isolated authorization tests. It verifies owner access, attacker and anonymous denial, strict schemas, disabled public snapshots, prevention of global listing, and scoped known-link reads.

## Data layout

- `trees/{treeId}` — private owner metadata.
- `trees/{treeId}/people/{personId}` — private people.
- `trees/{treeId}/relationships/{relationshipId}` — private relationships.
- `trees/{treeId}/members/{uid}` — future role records; not authorized for editing yet.
- `publicTrees/{publicId}` with `people` and `relationships` — separate enabled public snapshots.

The public URL is `/tree/{publicId}`. Treat it as a bearer link: anyone who obtains it can view every published name, date, note, and photo URL. Unpublish or regenerate the link to revoke access.

## Project structure

- `src/features/auth/` — Firebase auth state, guard, login actions, and safe errors.
- `src/features/tree/domain/` — validated online model, serialization, photo URLs, and revisions.
- `src/features/tree/repository/` — Firestore, in-memory, and local-cache boundaries.
- `src/features/tree/sync/` — optimistic/offline synchronization and conflict recovery.
- `src/features/tree/migration/` — resumable local-to-Firestore migration.
- `src/features/tree/publishing/` — unlisted snapshot lifecycle.
- `src/app/tree/[publicId]/` — anonymous read-only viewer.
- `tests/rules/` — Firestore Emulator Rules tests.
- `docs/superpowers/` — approved design specification and implementation plan.
