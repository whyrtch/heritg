# Own backend instead of Firebase — design

Status: proposed 2026-10-11, waiting for owner approval.
Supersedes the Firebase parts of `2026-10-11-heritg-us-parity-design.md` ("Keep Firebase login and Firestore sync") and the Firebase-based specs before it.

## Decision

The owner asked for this change in chat on 2026-10-11: "jangan pakai firebase, tapi buat backend saja". The owner chose:

| Topic | Choice |
|---|---|
| Backend | Next.js Route Handlers in this repo (`src/app/api/**`), TypeScript. One app, one deploy. |
| Database | PostgreSQL. |
| Auth | Our own email + password. Passwords hashed with Argon2id. Sessions in the database, carried by an httpOnly cookie. |
| Existing Firebase data | Moved once with a migration script. Firebase data is read only and never deleted. |
| Photo uploads | Allowed (owner, 2026-10-11): small JPEG/WebP thumbnails stored in Postgres. |

Everything visible stays as built:
- the heritg.us UI;
- the local-first browser cache;
- offline edits with revision conflicts;
- unlisted read-only public links;
- `.heritg` import and export.

Only the storage, auth and authorization layers change.

## Architecture

```
Browser (React)                         Next.js server                         PostgreSQL
─────────────────                       ──────────────                         ──────────
Workspace, dialogs ─┐                   src/app/api/** (Route Handlers)
useTreeSync         ├─ HttpTreeRepository ──► /api/trees/**  ──► src/server/trees ──► trees, people,
LocalTreeCache      │  HttpPublication…  ──► /api/trees/:id/publication             relationships,
useAuth (session)  ─┘  fetch + cookie    ──► /api/auth/**    ──► src/server/auth  ──► users, sessions,
Public page ───────────────────────────► /api/public/:publicId ─► src/server/public ► publications, photos
```

**Client side.**
- `TreeRepository` and `PublicationRepository` stay the client-side interfaces.
- `FirestoreTreeRepository` and `FirestorePublicationRepository` are replaced by `HttpTreeRepository` and `HttpPublicationRepository`, which `fetch` the API.
- `useTreeSync`, `LocalTreeCache`, migration of browser-local trees, and conflict handling keep working unchanged.

**Server side.**
- All server code lives under `src/server/**` and is never imported by client components; an ESLint rule enforces this.
- Route Handlers stay thin: parse, authorize, call a service, map errors to HTTP.

**Database access.**
- Drizzle ORM with the `postgres` driver. It is SQL-first, needs no binary engine, and drizzle-kit handles migrations.
- Tests run against **PGlite**, an in-process Postgres, so no Docker is needed on Windows. There is an optional `docker-compose.yml` for a local Postgres.

## Data model (PostgreSQL)

```
users            id uuid pk, email citext unique, password_hash text, display_name text,
                 created_at timestamptz, password_changed_at timestamptz
sessions         token_hash bytea pk (sha256 of the cookie token), user_id fk→users on delete cascade,
                 created_at, expires_at, last_seen_at, user_agent text
login_attempts   key text (ip or email), attempted_at timestamptz — rate limiting
trees            id text pk (client uuid, same as today), owner_id fk→users, name text(1..120),
                 revision int ≥0, schema_version int, created_at, updated_at,
                 visibility text check in (private, unlisted), public_id text unique null, published_revision int null
people           (tree_id fk→trees on delete cascade, id text) pk, name text(1..120), gender check,
                 birth_date text ISO-or-empty check, death_date, birth_order int null check 1..99,
                 residence text(0..120), notes text(0..10000), photo_url text https-or-empty, sort_order int, updated_at
relationships    (tree_id, id) pk, type check, from_person_id, to_person_id → fk (tree_id, person id) on delete cascade,
                 kind/status/married_on with the same per-type CHECK as the v2 Rules, from ≠ to
photos           (tree_id, person_id) pk → fk people on delete cascade, mime text check (image/jpeg|image/webp),
                 bytes bytea (≤ 49152), sha256 text, updated_at
publications     public_id text pk, tree_id fk→trees unique, enabled bool, name text,
                 published_revision int, published_at timestamptz,
                 snapshot jsonb (people + relationships, no owner identity)
public_photos    (public_id, person_id) pk → publications on delete cascade, mime, bytes, sha256
```

**Validation.**
- The Firestore Rules' v2 checks move to two places:
  - Zod schemas in `src/server/validation`, shared with the domain types;
  - `CHECK` / FK constraints as a second line.
- Relationship endpoints must exist in the same tree, which FKs enforce.
- Cycles are still checked in the domain (`addRelationship`).

**Saves are transactional.**
- `PUT /api/trees/:id` with `expectedRevision` runs in a single `SERIALIZABLE` transaction:
  - lock the tree row and compare its revision, answering 409 on conflict;
  - upsert or delete the changed people and relationships;
  - bump the revision.
- The Firestore batching, the 450-write limit, the operation documents and the "interrupted create" logic all go away. That closes the open follow-up chip about resumable creates.

**Photos.**
- Photos are uploaded and served through their own endpoints, so a tree save never carries image bytes.
- A `Person` gets `photoVersion: string | null` (the sha256 prefix), which lets the browser cache images with `ETag`/immutable URLs.
- Locally, offline, the existing `photo` data URL field holds a thumbnail that has not been uploaded yet. It is uploaded on the next sync.

## API

All endpoints take and return JSON, except image bytes. Errors use `{ error: { code, message } }`, where `code` is one of `unauthenticated`, `forbidden`, `not-found`, `conflict`, `invalid`, `rate-limited` or `too-large`.

| Method & path | Auth | Purpose |
|---|---|---|
| `POST /api/auth/login` | — | `{email, password}` → sets the session cookie. Rate-limited per IP and per email. Errors are neutral. |
| `POST /api/auth/logout` | session | Deletes the session row and clears the cookie. |
| `GET /api/auth/session` | optional | `{ user: {id, email, displayName} \| null }` |
| `POST /api/auth/password` | session | Change the password. This revokes every other session. |
| `GET /api/trees` | owner | List the owner's trees (metadata plus counts). |
| `POST /api/trees` | owner | Create a tree from an `OnlineTree` body. The id is client-generated. Answers 409 if the id exists for this owner, and 404 (not 403) if another owner has it. |
| `GET /api/trees/:id` | owner | Load the full `OnlineTree`. |
| `PUT /api/trees/:id` | owner | Save with `expectedRevision`. Answers 409 with the current tree on conflict. |
| `DELETE /api/trees/:id` | owner | Delete the tree and everything under it (cascade). |
| `PUT /api/trees/:id/people/:personId/photo` | owner | Raw JPEG/WebP body, at most 48 KB. Magic bytes are checked and the size is re-checked. Returns `{photoVersion}`. |
| `DELETE /api/trees/:id/people/:personId/photo` | owner | Remove the photo. |
| `GET /api/trees/:id/people/:personId/photo` | owner | Image bytes, `Cache-Control: private`. |
| `PUT /api/trees/:id/publication` | owner | Publish, or republish under a new `publicId`. Atomically copies a snapshot and its photos. |
| `DELETE /api/trees/:id/publication` | owner | Disable the link. The snapshot rows are deleted in the same transaction. |
| `GET /api/public/:publicId` | — | Enabled snapshot only. Unknown and disabled links give an identical 404. `X-Robots-Tag: noindex, nofollow`. |
| `GET /api/public/:publicId/photos/:personId` | — | Public thumbnail of an enabled snapshot. |

## Security model (replaces "Firestore Rules are the boundary")

**Authorization.**
- Every tree query is scoped `WHERE owner_id = $session.userId`, inside `src/server/trees`.
- There is no code path that reads a tree by id alone, except the public snapshot service, which reads only `publications`.
- A tree owned by someone else looks exactly like a tree that does not exist (404).

**Sessions.**
- Tokens are 32 random bytes. The database stores only their SHA-256.
- The cookie is `__Host-heritg_session`: `HttpOnly; Secure; SameSite=Lax; Path=/`. Expiry is 30 days, sliding, with `last_seen_at` throttled.
- The session ID rotates at login.
- Logout and a password change revoke sessions.

**CSRF.**
- Mutating endpoints require `SameSite=Lax` plus an `Origin`/`Host` match and `Content-Type: application/json` (or an image type on the photo upload).
- There are no GET side effects.

**Passwords.**
- Hashed with Argon2id via `@node-rs/argon2` (prebuilt for Windows, no node-gyp), at least 12 characters.
- Login runs in constant time for unknown emails (a dummy hash).
- Login is rate-limited: 5 failures per 15 minutes per email, and 20 per IP.

**Accounts.**
- There is no public registration, as today. The owner account is made with `npm run owner:create` (CLI, prompts for the password).
- Password reset is `npm run owner:reset-password`. The "Lupa password" link becomes help text, since there is no mail service.

**Input limits.**
- Request bodies are capped (2 MB for trees, 64 KB for photos).
- The same field limits as the v2 Rules apply.

**Public link.**
- The snapshot is a copy that holds no owner identity.
- Disabling it deletes the copy.
- The API and page keep `noindex, nofollow`, and the page stays read-only.

**Secrets.**
- `DATABASE_URL` lives only in `.env.local` or the server environment, and is never in a `NEXT_PUBLIC_*` variable.

## Migration from Firebase

**Firestore to Postgres.**
- `scripts/migrate-from-firestore.ts` uses `firebase-admin` with a service-account JSON that the owner provides through an env path.
- It reads `trees` where `ownerId == <uid>` together with their people, relationships and publications, and upserts them into Postgres for the owner user (matched by email).
- It supports `--dry-run`, is idempotent (upsert by id), and never writes to or deletes anything in Firebase.
- `firebase-admin` is a dev-only dependency of the script and is removed together with the script after the move.

**Browser-local trees.**
- The existing "Import family trees" dialog (`planMigration`/`runMigration`) keeps working against `HttpTreeRepository`.

**Public links.**
- Links that were published on Firebase are re-created with the same `publicId`, so shared links keep working once the app points at the new backend.

## Testing

- **Service and route tests.** Vitest runs against PGlite, with a fresh schema per test file. Each security property that `tests/rules` covered today gets an API test:
  - owner-only reads and writes;
  - another owner sees 404;
  - anonymous users get 401;
  - field validation;
  - relationships within one tree only;
  - public snapshots expose no owner data;
  - disabled links read as 404;
  - photo type and size checks.
- **Auth tests:**
  - login success and failure;
  - rate limit;
  - session expiry and rotation;
  - logout revocation;
  - password change revoking other sessions;
  - Origin check.
- **Client tests:** existing unit and component tests stay; the HTTP repositories are tested with a mocked `fetch`.
- **Scripts:** `npm run test:rules` is retired and replaced by `npm run test:api`.

## Out of scope / later

- Multiple editors per tree (Family+ collaboration).
- Email-based password reset (needs a mail provider).
- Moving photos to object storage once the database grows. The `photos` table is the seam for that.

## Risks

- The app needs a Node server and a Postgres database to host. Static or Firebase Hosting no longer works.
- Hosting is not part of this change: the owner chooses it at deploy time, and there are still no deploys without approval.
- Until the old Firebase app is turned off, two backends exist. The migration script can be re-run (it is idempotent) up to the switch.
