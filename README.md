# Heritg

Heritg is a personal, online family-tree archive. The owner signs in with an email and password, edits family trees that are stored in PostgreSQL through the app's own API, keeps working offline from a browser cache, and can publish a revocable unlisted read-only link per tree. Anyone with that link can view the published copy; only the owner can edit.

The app opens with a read-only example tree (`Keluarga Joko Widodo`).

## Features

- Owner-only email/password login (Argon2id, database sessions). There is no public registration.
- Several family trees with typed relationships (biological, step, adoptive, foster, guardian; married, partner, ex), cycle prevention, a pannable SVG canvas with Fokus and Lengkap views, kinship labels in four dialects, and `.heritg` import and export.
- The server is the source of truth, with optimistic saves, an offline queue, revision conflicts and `.heritg` backup recovery. Local browser data is never deleted automatically.
- Photos: an HTTPS link, or an uploaded image shrunk in the browser to a small JPEG/WebP thumbnail (at most 256 px and 48 KB) and stored in PostgreSQL.
- Per-tree unlisted publication: copy the link, update it, regenerate it, or unpublish. Public pages are read-only and marked `noindex, nofollow`.

## Local setup

Requirements: Node.js 20.12 or newer, npm, and PostgreSQL 16 (Docker is easiest).

```bash
npm install
docker compose up -d                 # local PostgreSQL on 127.0.0.1:5432
```

Create `.env.local` with:

```bash
DATABASE_URL=postgres://heritg:heritg@localhost:5432/heritg
APP_URL=http://localhost:3000
```

Then create the tables and your owner account, and start the app:

```bash
npm run db:migrate
npm run owner:create -- you@example.com "Your name"
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and sign in.

Forgot the password? There is no email service. Reset it on the server with `npm run owner:reset-password -- you@example.com`; every device is signed out.

### Environment variables

| Variable | Needed | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | PostgreSQL connection string (server only; never put it in a `NEXT_PUBLIC_*` variable). |
| `APP_URL` | in production | The public origin, e.g. `https://heritg.example`. State-changing requests must come from exactly this origin; without it in production, every POST (including login) is refused. |
| `TRUSTED_PROXY_HOPS` | behind a proxy | How many reverse proxies append to `X-Forwarded-For` (usually `1`). Login limits per address only use addresses from trusted hops. Default `0`. |
| `DATABASE_POOL_MAX` | optional | Connection pool size (default 10). |
| `NEXT_PUBLIC_APP_URL` | optional | Canonical URL for page metadata. |

## Deployment

This repository does not deploy automatically, and nothing is deployed without the owner's approval. The app needs a Node.js server (`npm run build`, then `npm start`) and a PostgreSQL database. Run `npm run db:migrate` against the production database before starting a new version; it reads `DATABASE_URL` from the environment or `.env.local` and fails if it is not set. Serve it over HTTPS: session cookies are `Secure`.

## Moving data from Firebase (one time)

Earlier versions stored trees in Firebase. To copy your existing online trees into PostgreSQL:

1. Create your account on the new backend: `npm run owner:create -- you@example.com`.
2. In the Firebase Console, open *Project settings → Service accounts* and generate a private key (a JSON file). Keep it outside the repository, and delete it when you are done.
3. Put these in `.env.local`:
   - `DATABASE_URL`
   - `OWNER_EMAIL` (the account from step 1)
   - `FIREBASE_OWNER_UID` (your user id under *Authentication → Users*)
   - `NEXT_PUBLIC_FIREBASE_PROJECT_ID` (your Firebase project id)
   - `GOOGLE_APPLICATION_CREDENTIALS` (the path to that JSON file)
4. Try it first: `npm run migrate:firestore -- --dry-run`. This only reads and reports.
5. Import: `npm run migrate:firestore`. Add `--save-json backup.json` to keep a copy of what was read (`.gitignore` already excludes such files and service-account keys).

What the import does:
- Firebase is only read; nothing there is changed or deleted.
- Old (v1) trees are upgraded on the way.
- Shared links are re-created with the same address, showing exactly what was published.
- Re-running skips trees that already exist, so edits made on the new backend are kept. Use `--overwrite` to replace their content; a shared link already made, or revoked, on the new backend is left as it is.
- A link that could not be restored is reported (exit code 1) and is restored on the next run.
- `--from-json backup.json` imports a saved copy without contacting Firebase.

Trees that only ever lived in a browser are offered by the app's **Import family trees** prompt after you sign in.

## Verification

```bash
npm test -- --run      # unit and component tests
npm run test:api       # API, authorization and database tests (in-process PostgreSQL, no Docker needed)
npm run lint
npm run build
```

`npm run test:api` covers:
- owner-only access (another owner's tree is a 404, anonymous requests are 401);
- login limits, session expiry and rotation, and the CSRF origin check;
- validation and database constraints;
- revision conflicts;
- public links (unknown, revoked and malformed look the same);
- photo type and size checks;
- the Firebase import.

## Data layout (PostgreSQL)

- `users`, `sessions`, `login_attempts`: the owner account, hashed session tokens and login limits.
- `trees`: owner, name, revision, visibility and the public link id.
- `people` and `relationships`: kept inside their tree by foreign keys, with CHECK constraints mirroring the API validation.
- `photos`: uploaded thumbnails per person.
- `publications` and `public_photos`: the read-only copy behind a public link. It contains no owner data, and unpublishing deletes it.

The public URL is `/tree/{publicId}`. Treat it as a bearer link: anyone who has it can view every published name, date, residence, note, photo and family relationship. Unpublish or regenerate the link to revoke access.

## Project structure

- `src/server/` contains server-only code:
  - `db/`: schema and client;
  - `auth/`: passwords, sessions, limits, guard;
  - `trees/`, `publications/`, `photos/`: services and validation;
  - `migration/`: the Firebase import.
- `src/app/api/`: thin Route Handlers over `src/server`.
- `src/features/auth/`: session state, the owner guard and login errors.
- `src/features/tree/` contains the browser side of the tree:
  - `domain/`: the online model, serialization, photo helpers and revisions;
  - `repository/`: the HTTP, in-memory and local-cache repositories;
  - `sync/`: optimistic/offline synchronization, conflict recovery and the photo upload queue;
  - `migration/`: moving browser-only trees to the account;
  - `publishing/`: the unlisted link lifecycle;
  - `canvas/`: the SVG family canvas, layouts and kinship;
  - `dialogs/`: the add/edit dialogs.
- `src/app/tree/[publicId]/`: the anonymous read-only viewer.
- `drizzle/`: SQL migrations (`npm run db:generate` after changing `src/server/db/schema.ts`).
- `scripts/`: the owner account CLI and the one-time Firebase import.
- `tests/api/`: API and database tests.
- `docs/superpowers/`: design specifications and implementation plans.
