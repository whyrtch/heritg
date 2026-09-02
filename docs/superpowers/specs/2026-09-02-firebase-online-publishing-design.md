# Heritg Phase 2: Firebase Online Publishing Design

## Objective

Turn the local-first Heritg MVP into a personal online family archive. A single owner signs in with email and password to manage family trees. Each tree can remain private or be published through its own unlisted link. Anyone who possesses a valid link can view the complete published tree without signing in, but only the owner can edit during Phase 2.

The data model must support invited editors in a later phase without implementing invitation or multi-editor workflows now.

## Scope

### Included

- Firebase Authentication with email and password.
- One owner account created manually in Firebase Console.
- No public registration.
- Cloud Firestore as the source of truth after sign-in.
- Local browser persistence as startup cache, offline working state, and migration source.
- Independent private/unlisted visibility for every tree.
- Unlisted public pages at `/tree/[publicId]`.
- Publish, copy link, unpublish, and regenerate-link actions.
- Read-only public family-tree canvas.
- Migration of existing local MVP data after first sign-in.
- Photo URL input and preview instead of file upload.
- Firebase Emulator Suite and Security Rules tests.
- Firebase Hosting-compatible static/client-first deployment.

### Deferred

- Public account registration.
- Invitations, invitation acceptance, and email delivery.
- Multiple active editors or viewers with accounts.
- Ownership transfer.
- Real-time collaborative conflict resolution.
- Firebase Storage or any binary upload service.
- Cloud Functions, Admin SDK, or a custom backend.

## Technical Direction

Use the Firebase Web SDK directly from the existing Next.js client application. Firebase Authentication establishes identity, and Firestore Security Rules are the authoritative authorization layer. The app does not rely on hidden client configuration for security; Firebase web configuration is public by design, while access is enforced by Authentication and Rules.

The application remains Firebase Hosting compatible. It does not require Next.js server actions, API routes, Cloud Functions, or Firebase App Hosting. This preserves eligibility for a Spark-plan deployment without a billing account, subject to Firebase's current quotas.

Cloud Firestore is the online source of truth. The browser's internal database is a cache and offline queue, not an independent peer database. After a user signs in and migration is complete, conflict rules prefer explicit resolution rather than silently overwriting a newer remote revision.

## Routes

- `/` — authenticated owner workspace. Unauthenticated users are redirected to `/login`.
- `/login` — email/password login and password-reset request. It contains no registration action.
- `/tree/[publicId]` — anonymous read-only view of one published snapshot.
- Invalid, disabled, regenerated, or unknown public IDs show a generic unavailable page that does not reveal whether a private tree exists.

## Authentication

The owner account is created manually in Firebase Console. The app supports:

- Email/password sign-in.
- Persistent browser sessions through Firebase Auth persistence.
- Sign-out.
- Password reset email.
- Loading state until the initial auth state is known, preventing a flash of private workspace data.

The application never treats an email address stored in a client environment variable as authorization. Firestore documents and Security Rules identify users by Firebase Auth UID.

## Firestore Data Model

### Private working data

```text
users/{uid}
  email: string
  displayName: string
  createdAt: timestamp

trees/{treeId}
  ownerId: string
  name: string
  visibility: "private" | "unlisted"
  publicId: string | null
  revision: number
  schemaVersion: number
  createdAt: timestamp
  updatedAt: timestamp
  publishedRevision: number | null

trees/{treeId}/members/{uid}
  role: "owner" | "editor" | "viewer"
  invitedAt: timestamp | null
  acceptedAt: timestamp | null

trees/{treeId}/people/{personId}
  firstName: string
  lastName: string
  gender: "female" | "male" | "nonbinary" | "unspecified"
  birthDate: string
  deathDate: string
  notes: string
  photoUrl: string
  sortOrder: number
  updatedAt: timestamp

trees/{treeId}/relationships/{relationshipId}
  type: "parent-child" | "partner"
  fromPersonId: string
  toPersonId: string
  updatedAt: timestamp
```

The owner receives a matching `members/{ownerId}` record with role `owner`. The members schema exists to avoid a future data migration, but Phase 2 authorization grants writes only to `ownerId`. Editor and viewer records are not created by the Phase 2 UI.

### Unlisted public snapshots

```text
publicTrees/{publicId}
  sourceTreeId: string
  name: string
  enabled: boolean
  schemaVersion: number
  publishedRevision: number
  publishedAt: timestamp

publicTrees/{publicId}/people/{personId}
  ...public person fields

publicTrees/{publicId}/relationships/{relationshipId}
  ...public relationship fields
```

Public snapshots intentionally contain all person fields selected for Phase 2: names, gender, dates, notes, and photo URLs. The public documents do not contain owner email, UID, member data, internal sync metadata, or private working history.

## Public Access Semantics

Unlisted access is link possession, not user authentication. A `publicId` is generated from at least 128 bits of cryptographically secure randomness and contains no user, tree, or family identifiers.

Anonymous users:

- May perform an exact read of `publicTrees/{publicId}` when it exists and is enabled.
- May query the `people` and `relationships` subcollections beneath that exact public ID.
- May not list or query the top-level `publicTrees` collection.
- May not read `trees`, `users`, or `members`.
- May not write any document.

Anyone who receives a link can forward it. The publishing dialog communicates this explicitly. Public pages set `robots: noindex, nofollow`, but robots directives are not treated as access control.

## Owner Authorization

Security Rules enforce these invariants:

- Authenticated users can read a private tree only when they are its owner in Phase 2.
- Only the existing owner can update or delete a tree.
- `ownerId` cannot change in an update.
- A new tree's `ownerId` must equal `request.auth.uid`.
- Only the owner can read or write people, relationships, members, and public snapshots derived from their tree.
- Anonymous writes are always denied.
- Rules validate allowed keys, field types, string limits, relationship types, HTTPS photo URLs, nonnegative revision values, and ownership consistency.
- Global collection enumeration is denied unless an authenticated query is constrained to the current owner in a rules-compatible form.

Future editor roles are represented in data but do not authorize writes until the invitation design is implemented and separately reviewed.

## Publishing Lifecycle

### Publish

The owner chooses “Publish with link.” The client generates a secure `publicId`, writes a complete public snapshot using a batched write, and updates the private tree's visibility/publication metadata only when all writes succeed. The resulting URL is displayed with a copy action.

### Update

Private edits autosave first. If the tree is published, the app then synchronizes the public snapshot. The editor shows separate working-data and public-snapshot statuses. A public update failure never rolls back or loses the private edit; it marks the public version as stale and offers retry.

### Unpublish

The app disables the public metadata document before removing snapshot children. Once disabled, anonymous rules deny reads even if cleanup is interrupted. The private tree remains unchanged.

### Regenerate Link

The app creates and verifies a new public snapshot before disabling the previous `publicId`. The previous URL becomes unavailable. If creation of the new snapshot fails, the existing link stays active and the UI reports that regeneration did not complete.

## Photo URLs

Binary upload is removed. `Person.photo` is replaced or migrated to `Person.photoUrl`.

The form provides:

- An optional URL input.
- HTTPS-only validation.
- Preview before save.
- Loading and broken-image fallback to initials.
- Replace and remove actions.
- A warning that Google Drive share/view URLs are not guaranteed direct image URLs.

Existing local data-URL photos are not uploaded to Firestore. During migration, the user must replace them with HTTPS URLs or continue without a photo. This prevents large Firestore documents and avoids Firebase Storage's billing-plan requirement.

## Local Cache and Offline Behavior

The current browser persistence is retained behind a repository abstraction. The online repository writes Firestore documents; the local repository stores a normalized snapshot, pending operations, the last synchronized revision, and migration status.

UI status is explicit:

- `Saving` — a local optimistic change is being sent.
- `Saved` — Firestore acknowledged the current revision.
- `Offline` — work is retained locally and queued.
- `Conflict` — the remote revision changed unexpectedly.
- `Public update pending` — private data is saved but the public snapshot is stale.

Offline edits are ordered operations with stable IDs. Reconnection reloads remote metadata, compares revision numbers, and applies queued writes only when the expected remote revision still matches.

## Conflict Handling

Each accepted tree mutation increments `revision`. A write transaction verifies the expected previous revision. If it differs, the app downloads both versions and does not silently overwrite either one.

Phase 2 presents a conflict dialog with:

- Keep remote and export the local version as a `.heritg` backup.
- Replace remote with the local version after a second explicit confirmation.

Field-level or multiplayer merging is deferred to the collaboration phase.

## Existing-Data Migration

After the owner's first successful login, the app detects local MVP trees that lack remote mappings and offers a migration preview.

- The user selects which local trees to upload.
- Data is validated using the existing domain validator.
- Data-URL photos are excluded and reported before upload.
- Each tree, owner member, people, and relationships are uploaded atomically where batch limits allow; larger trees use deterministic chunks with resumable migration metadata.
- Local data is not deleted.
- A tree is marked migrated only after remote verification succeeds.
- Re-running migration does not create duplicates because local-to-remote mappings are stable.

## Error Handling

- Login errors use safe, actionable messages without revealing account existence unnecessarily.
- Password-reset submission displays a neutral success message regardless of whether an account exists.
- Permission-denied errors identify that the current account cannot edit the tree and never retry indefinitely.
- Offline state preserves user input and clearly distinguishes queued changes from cloud-saved changes.
- Failed public synchronization displays the last published revision and a retry action.
- Invalid public links show a generic unavailable screen.
- Broken external photos fall back to initials without breaking layout.
- Migration failures preserve both local and remote data and can resume safely.

## Firebase Free-Tier Constraints

The design targets Firebase's Spark plan:

- One Firestore database.
- Firebase Authentication email/password.
- Firebase Hosting for the static/client application.
- No Cloud Storage for Firebase.
- No Cloud Functions, App Hosting, or server-side Firebase Admin SDK.

Public snapshot data duplicates private data, trading a small storage increase for simpler and safer rules. Reads are minimized by loading one tree at a time, avoiding unbounded listeners, and using cached snapshots. The UI should expose no operation that can accidentally trigger broad collection scans.

## Testing Strategy

### Unit tests

- Public ID generation format and entropy source.
- Local-to-Firestore serialization.
- Data-URL photo exclusion and HTTPS photo validation.
- Revision increments and conflict detection.
- Migration idempotency and chunk boundaries.
- Publish, unpublish, regenerate, and stale-public-state reducers.

### Firebase Emulator tests

- Anonymous exact reads of enabled public snapshot data succeed.
- Anonymous top-level public-tree listing fails.
- Anonymous private-tree, users, and members reads fail.
- Anonymous writes fail everywhere.
- Owner CRUD succeeds for owned tree data.
- A different authenticated UID cannot read or write private tree data.
- Owner cannot change `ownerId`.
- Malformed person, relationship, member, and publication documents are rejected.
- Disabled or old regenerated public IDs deny anonymous access.

### Component and integration tests

- Auth loading, login, logout, and neutral password reset.
- Route guard behavior.
- Existing-data migration preview and success/failure states.
- Saving, saved, offline, conflict, and stale-public indicators.
- Publish/copy/unpublish/regenerate flows.
- Photo URL preview and broken-image fallback.
- Read-only public canvas contains no edit actions.

### End-to-end tests

- Owner login and migration of an existing local tree.
- Online edit followed by reload from Firestore.
- Offline edit followed by successful reconnection.
- Revision conflict with both recovery choices.
- Publish and anonymous viewing in a clean browser context.
- Unpublish and regenerate invalidate prior URLs.
- Unauthorized account cannot edit or enumerate private trees.
- Desktop and mobile flows remain functional.

## Acceptance Criteria

- The owner can sign in, migrate existing trees, create and edit online trees, sign out, and recover access through password reset.
- Every tree can be independently private or published through an unlisted URL.
- Anonymous visitors with a valid link can view all published family data and cannot edit.
- Anonymous visitors without a valid link cannot enumerate or access family data.
- Existing local data is never deleted by migration or synchronization failure.
- Photo upload is absent; valid HTTPS photo URLs render with safe fallbacks.
- Security Rules and emulator tests demonstrate owner-only private writes and scoped anonymous public reads.
- Unit, component, end-to-end, lint, TypeScript, and production-build checks pass.
- The Firebase configuration, emulator setup, rules, indexes, environment example, deployment instructions, and manual owner-account creation are documented.

## Known Boundary

An unlisted URL is a bearer secret, not authenticated privacy. Anyone who obtains it can view and redistribute all fields in its published snapshot. Regenerating or unpublishing the link is the only Phase 2 revocation mechanism. Account invitations and additional editors require a separate security design before their role values are enabled in Rules.
