# Heritg Phase 2 Firebase Online Publishing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add owner-only online editing, offline-safe Firestore synchronization, and independently revocable unlisted public links to the existing Heritg family-tree application.

**Architecture:** Firebase Web SDK supplies email/password Authentication and direct Firestore access. Private normalized tree documents are owner-only; publication creates a separate anonymous-readable snapshot under a cryptographically random public ID. Repository interfaces isolate Firestore, browser cache, migration, publication, and conflict handling from React UI.

**Tech Stack:** Next.js 15, React 19, TypeScript, Firebase Web SDK, Cloud Firestore, Firebase Authentication, Firebase Hosting, Firebase Emulator Suite, Vitest, Testing Library, `@firebase/rules-unit-testing`.

**Spec:** `docs/superpowers/specs/2026-09-02-firebase-online-publishing-design.md`

## Global Constraints

- One manually created email/password owner account; no public registration.
- Firestore is the source of truth after login; browser storage is cache, offline queue, and migration source.
- Every tree is private by default and has an independent unlisted publication state.
- Anonymous users may read only an enabled snapshot under a known `publicId`; global listing and all anonymous writes are denied.
- Phase 2 reserves member roles but authorizes writes only for `ownerId`.
- Photo upload is removed; only HTTPS photo URLs are accepted.
- No Firebase Storage, Cloud Functions, Admin SDK, App Hosting, or custom server.
- Existing local trees are never deleted by migration or sync failure.
- Public pages use `noindex, nofollow` and contain no edit controls.
- Security behavior must be demonstrated with Firebase Emulator Rules tests.

---

## File Map

- `.firebaserc`, `firebase.json`, `firestore.rules`, `firestore.indexes.json`: Firebase project/emulator/deployment definition.
- `.env.example`, `src/lib/firebase/config.ts`: public Firebase web configuration and guarded initialization.
- `src/features/auth/*`, `src/app/login/*`: auth state, route guard, login, reset, logout.
- `src/features/tree/domain/*`: normalized online types, photo URL validation, revision and migration transformations.
- `src/features/tree/repository/*`: local and Firestore repository contracts and implementations.
- `src/features/tree/sync/*`: optimistic state, offline queue, revision conflict, and public snapshot orchestration.
- `src/features/tree/publishing/*`: public ID generation and publish lifecycle.
- `src/app/tree/[publicId]/*`: anonymous read-only public route.
- `tests/rules/*`: emulator-backed Firestore authorization tests.

### Task 1: Firebase Configuration and Emulator Foundation

**Files:**
- Modify: `package.json`, `package-lock.json`, `.env.example`, `.gitignore`, `README.md`
- Create: `.firebaserc`, `firebase.json`, `firestore.rules`, `firestore.indexes.json`
- Create: `src/lib/firebase/config.ts`, `src/lib/firebase/config.test.ts`

**Interfaces:**
- Produces: `getFirebaseApp(): FirebaseApp`, `getFirebaseAuth(): Auth`, `getFirestoreDb(): Firestore`, and `isFirebaseConfigured(): boolean`.

- [ ] **Step 1: Install Firebase runtime and rules-test dependencies**

```bash
npm install firebase
npm install -D firebase-tools @firebase/rules-unit-testing
```

- [ ] **Step 2: Add environment configuration test**

```ts
it("reports missing Firebase configuration without throwing during build", () => {
  expect(isFirebaseConfigured({})).toBe(false);
});

it("accepts the complete public web configuration", () => {
  expect(isFirebaseConfigured(completeConfig)).toBe(true);
});
```

Run: `npm test -- --run src/lib/firebase/config.test.ts`

Expected: FAIL because the configuration module does not exist.

- [ ] **Step 3: Implement lazy guarded Firebase initialization**

Read `NEXT_PUBLIC_FIREBASE_API_KEY`, `AUTH_DOMAIN`, `PROJECT_ID`, `APP_ID`, `MESSAGING_SENDER_ID`, and optional `STORAGE_BUCKET`. Do not initialize at module evaluation when required values are absent. Connect Auth and Firestore to emulators when `NEXT_PUBLIC_USE_FIREBASE_EMULATORS=true`.

- [ ] **Step 4: Add Firebase project files**

Configure Hosting output, SPA rewrites, Auth emulator on 9099, Firestore emulator on 8080, and Emulator UI on 4000. Begin `firestore.rules` with default deny-all so no data is exposed before later rules tasks.

- [ ] **Step 5: Document and verify configuration**

Run: `npm test -- --run src/lib/firebase/config.test.ts && npm run lint && npm run build`

```bash
git add package.json package-lock.json .env.example .gitignore .firebaserc firebase.json firestore.rules firestore.indexes.json src/lib/firebase README.md
git commit -m "chore: add Firebase emulator foundation"
```

### Task 2: Authentication and Owner Route Guard

**Files:**
- Create: `src/features/auth/AuthProvider.tsx`, `src/features/auth/useAuth.ts`
- Create: `src/features/auth/authErrors.ts`, `src/features/auth/authErrors.test.ts`
- Create: `src/features/auth/RequireOwner.tsx`
- Create: `src/app/login/page.tsx`, `src/app/login/login.module.css`, `src/app/login/page.test.tsx`
- Modify: `src/app/layout.tsx`, `src/app/page.tsx`, `src/features/tree/Workspace.tsx`

**Interfaces:**
- Produces: `AuthProvider`, `useAuth(): { user, status, signIn, signOut, resetPassword }`, and `RequireOwner`.

- [ ] **Step 1: Write failing auth and login UI tests**

Test loading state, authenticated rendering, unauthenticated redirect, email/password submission, neutral reset confirmation, disabled submission, and safe error mapping.

```tsx
expect(screen.queryByRole("link", { name: /register/i })).not.toBeInTheDocument();
await user.click(screen.getByRole("button", { name: /send reset link/i }));
expect(await screen.findByText(/if an account exists/i)).toBeVisible();
```

- [ ] **Step 2: Implement `AuthProvider`**

Subscribe once with `onAuthStateChanged`, configure local persistence, expose typed async actions, and unsubscribe on unmount. Never expose raw Firebase error objects to UI.

- [ ] **Step 3: Implement login and reset UX**

Reuse the warm archival design tokens. Provide login, password visibility, reset mode, loading state, validation, and accessible status announcements. Do not include sign-up.

- [ ] **Step 4: Guard the owner workspace and add logout**

Render a neutral auth-loading screen until Firebase resolves. Redirect signed-out visitors to `/login`. Preserve `/tree/[publicId]` as an unguarded route.

- [ ] **Step 5: Verify and commit**

Run: `npm test -- --run src/features/auth src/app/login && npm run lint && npm run build`

```bash
git add src/features/auth src/app/login src/app/layout.tsx src/app/page.tsx src/features/tree/Workspace.tsx
git commit -m "feat: add owner authentication"
```

### Task 3: Online Domain Model and Photo URL Migration

**Files:**
- Create: `src/features/tree/domain/onlineTypes.ts`
- Create: `src/features/tree/domain/photoUrl.ts`, `src/features/tree/domain/photoUrl.test.ts`
- Create: `src/features/tree/domain/serialization.ts`, `src/features/tree/domain/serialization.test.ts`
- Create: `src/features/tree/domain/revision.ts`, `src/features/tree/domain/revision.test.ts`
- Modify: `src/features/tree/model.ts`, `src/features/tree/demoData.ts`, `src/features/tree/Workspace.tsx`

**Interfaces:**
- Produces: `OnlineTree`, `OnlinePerson`, `OnlineRelationship`, `TreeMember`, `toOnlineTree()`, `fromOnlineTree()`, `validatePhotoUrl()`, `nextRevision()`, and `detectRevisionConflict()`.

- [ ] **Step 1: Write failing serialization and validation tests**

```ts
expect(validatePhotoUrl("https://images.example.test/person.webp")).toEqual({ ok: true });
expect(validatePhotoUrl("data:image/png;base64,...").ok).toBe(false);
expect(toOnlineTree(localTree).excludedDataUrlPhotoIds).toContain(person.id);
```

Cover exact field mapping, timestamps, public-safe fields, stable IDs, revision increments, and conflict detection.

- [ ] **Step 2: Define normalized online types**

Use `photoUrl`, `ownerId`, `visibility`, `publicId`, `revision`, `publishedRevision`, and schema version fields exactly as specified. Keep Firebase-specific timestamp conversion at the repository boundary.

- [ ] **Step 3: Replace upload UI with URL preview**

Remove file input and FileReader logic. Accept only empty or HTTPS URLs, show preview before save, handle `onError` with initials, and allow removal. Existing data URLs remain readable locally but are flagged for migration exclusion.

- [ ] **Step 4: Implement revision helpers and serializers**

Serializers reject unsupported or malformed documents and do not use unchecked casts for Firestore payloads.

- [ ] **Step 5: Verify and commit**

Run: `npm test -- --run src/features/tree/domain src/features/tree/model.test.ts && npm run lint && npm run build`

```bash
git add src/features/tree/domain src/features/tree/model.ts src/features/tree/demoData.ts src/features/tree/Workspace.tsx
git commit -m "feat: add online tree domain model"
```

### Task 4: Firestore Repository and Local Cache Boundary

**Files:**
- Create: `src/features/tree/repository/TreeRepository.ts`
- Create: `src/features/tree/repository/FirestoreTreeRepository.ts`
- Create: `src/features/tree/repository/LocalTreeCache.ts`
- Create: `src/features/tree/repository/InMemoryTreeRepository.ts`
- Test: corresponding `*.test.ts` files
- Modify: `src/features/tree/useWorkspace.ts`

**Interfaces:**
- Produces: `TreeRepository.listOwned(uid)`, `.load(treeId)`, `.create(tree)`, `.save(tree, expectedRevision)`, `.delete(treeId)`, and `LocalTreeCache.load/save/enqueue/dequeue`.

- [ ] **Step 1: Write repository contract tests**

Run the same suite against `InMemoryTreeRepository`; assert owner filtering, normalized people/relationship loading, atomic revision checks, stable error codes, and no partial mutation on failure.

- [ ] **Step 2: Implement repository contract and in-memory adapter**

Define typed errors: `permission-denied`, `offline`, `conflict`, `not-found`, and `invalid-data`. The UI must not depend on Firebase error codes.

- [ ] **Step 3: Implement Firestore adapter**

Use owner-constrained queries, transactions for revision metadata, and batched writes for normalized child documents. Split batches below Firestore limits and record resumable operation metadata before the first chunk.

- [ ] **Step 4: Implement local cache and migrate `useWorkspace`**

Wrap the existing storage key behind `LocalTreeCache`. Store last synchronized revision and ordered pending operations. Preserve legacy payload compatibility.

- [ ] **Step 5: Verify and commit**

Run: `npm test -- --run src/features/tree/repository && npm run lint && npm run build`

```bash
git add src/features/tree/repository src/features/tree/useWorkspace.ts
git commit -m "feat: add Firestore tree repository"
```

### Task 5: Offline Synchronization and Conflict Recovery

**Files:**
- Create: `src/features/tree/sync/types.ts`
- Create: `src/features/tree/sync/syncReducer.ts`, `src/features/tree/sync/syncReducer.test.ts`
- Create: `src/features/tree/sync/useTreeSync.ts`, `src/features/tree/sync/useTreeSync.test.tsx`
- Create: `src/features/tree/components/SyncStatus.tsx`
- Create: `src/features/tree/components/ConflictDialog.tsx`
- Modify: `src/features/tree/Workspace.tsx`, `src/features/tree/workspace.module.css`

**Interfaces:**
- Produces: `useTreeSync(): { state, mutate, retry, resolveConflict }` and statuses `loading | saving | saved | offline | conflict | public-stale`.

- [ ] **Step 1: Write failing reducer and hook tests**

Cover optimistic mutation, acknowledged save, offline enqueue, ordered reconnect replay, revision conflict, keep-remote/export-local, replace-remote confirmation, and public-stale state.

- [ ] **Step 2: Implement sync state machine**

Every mutation receives an operation ID and expected revision. Do not discard optimistic local data on a network failure. Deduplicate acknowledged operations after reconnect.

- [ ] **Step 3: Implement conflict recovery**

Keep-remote replaces the cache only after producing a downloadable `.heritg` local backup. Replace-remote requires a second confirmation and a fresh transaction against the currently observed revision.

- [ ] **Step 4: Add visible workspace status**

Show Saving, Saved, Offline, Conflict, and Public update pending in the header with accessible live-region announcements and retry actions.

- [ ] **Step 5: Verify and commit**

Run: `npm test -- --run src/features/tree/sync src/features/tree/components && npm run lint && npm run build`

```bash
git add src/features/tree/sync src/features/tree/components src/features/tree/Workspace.tsx src/features/tree/workspace.module.css
git commit -m "feat: add offline-safe tree synchronization"
```

### Task 6: Existing Local Data Migration

**Files:**
- Create: `src/features/tree/migration/types.ts`
- Create: `src/features/tree/migration/planMigration.ts`, `src/features/tree/migration/planMigration.test.ts`
- Create: `src/features/tree/migration/runMigration.ts`, `src/features/tree/migration/runMigration.test.ts`
- Create: `src/features/tree/components/MigrationDialog.tsx`, `src/features/tree/components/MigrationDialog.test.tsx`
- Modify: `src/features/tree/Workspace.tsx`

**Interfaces:**
- Produces: `planMigration(local, mappings)`, `runMigration(plan, repository)`, and idempotent local-to-remote ID mappings.

- [ ] **Step 1: Write failing migration tests**

Test selection, data validation, data-URL exclusion reporting, stable mappings, resumable chunks, failure preservation, verification before completion, and repeat-run idempotency.

- [ ] **Step 2: Implement migration planning**

Return exact tree/person counts, excluded photo IDs, validation errors, and estimated write counts before any remote mutation.

- [ ] **Step 3: Implement resumable migration execution**

Persist mappings locally before remote writes. Upload deterministic chunks and verify remote counts/revision. Never delete the local source.

- [ ] **Step 4: Add migration dialog**

After first owner login, show selectable local trees, excluded-photo warnings, progress, safe retry, and an explicit postpone action.

- [ ] **Step 5: Verify and commit**

Run: `npm test -- --run src/features/tree/migration && npm run lint && npm run build`

```bash
git add src/features/tree/migration src/features/tree/components/MigrationDialog.tsx src/features/tree/components/MigrationDialog.test.tsx src/features/tree/Workspace.tsx
git commit -m "feat: migrate local trees to Firestore"
```

### Task 7: Publication Service and Read-Only Public Route

**Files:**
- Create: `src/features/tree/publishing/publicId.ts`, `src/features/tree/publishing/publicId.test.ts`
- Create: `src/features/tree/publishing/PublicationRepository.ts`
- Create: `src/features/tree/publishing/FirestorePublicationRepository.ts`
- Create: `src/features/tree/publishing/publishTree.ts`, `src/features/tree/publishing/publishTree.test.ts`
- Create: `src/features/tree/components/PublishDialog.tsx`, `src/features/tree/components/PublishDialog.test.tsx`
- Create: `src/app/tree/[publicId]/page.tsx`, `src/app/tree/[publicId]/PublicTree.tsx`, `src/app/tree/[publicId]/publicTree.module.css`
- Modify: `src/features/tree/Workspace.tsx`

**Interfaces:**
- Produces: `generatePublicId()`, `publishTree()`, `updatePublishedTree()`, `unpublishTree()`, `regeneratePublicId()`, and anonymous `loadPublicTree(publicId)`.

- [ ] **Step 1: Write public ID and lifecycle tests**

Verify at least 128 bits of Web Crypto randomness, URL-safe output, no source identifiers, publish atomicity, disabled-first unpublish, create-before-disable regeneration, and stale-public retry state.

- [ ] **Step 2: Implement publication repository and orchestration**

Write snapshots beneath `publicTrees/{publicId}`. Public readers never access private paths. When cleanup is interrupted, disabled metadata must cause immediate anonymous denial.

- [ ] **Step 3: Replace deferred Share dialog with publication controls**

Display privacy warning, Publish with link, Copy link, Unpublish, Regenerate link, published revision, and retry. Family+ remains deferred.

- [ ] **Step 4: Implement anonymous public route**

Load only the exact public path, render existing family canvas in read-only mode, include no owner controls, set `noindex, nofollow`, and show a generic unavailable screen for every inaccessible state.

- [ ] **Step 5: Verify and commit**

Run: `npm test -- --run src/features/tree/publishing src/app/tree && npm run lint && npm run build`

```bash
git add src/features/tree/publishing src/features/tree/components/PublishDialog.tsx src/features/tree/components/PublishDialog.test.tsx src/app/tree src/features/tree/Workspace.tsx
git commit -m "feat: publish unlisted family trees"
```

### Task 8: Production Firestore Security Rules

**Files:**
- Modify: `firestore.rules`, `firestore.indexes.json`, `package.json`
- Create: `tests/rules/helpers.ts`
- Create: `tests/rules/privateTrees.rules.test.ts`
- Create: `tests/rules/publicTrees.rules.test.ts`
- Create: `tests/rules/validation.rules.test.ts`

**Interfaces:**
- Produces: deployable owner-only private rules and scoped anonymous snapshot reads.

- [ ] **Step 1: Write failing emulator Rules tests**

Use `@firebase/rules-unit-testing` with owner UID, attacker UID, and unauthenticated contexts. Assert every access matrix row from the specification before relaxing deny-all rules.

```ts
await assertSucceeds(anonymous.firestore().doc(`publicTrees/${publicId}`).get());
await assertFails(anonymous.firestore().collection("publicTrees").get());
await assertFails(attacker.firestore().doc(`trees/${treeId}`).get());
```

- [ ] **Step 2: Implement shared Rules predicates**

Implement `isSignedIn`, `isOwner`, exact allowed-key checks, HTTPS-or-empty photo URL validation, person validation, relationship validation, immutable owner validation, and enabled-public-parent checks.

- [ ] **Step 3: Implement private and public access rules**

Private working collections are owner-only. Anonymous exact public metadata and known-path subcollection reads succeed only while the public parent is enabled. All writes require the source-tree owner.

- [ ] **Step 4: Add required owner index**

Define the index supporting `trees where ownerId == uid orderBy updatedAt desc`; avoid indexes that expose or encourage global public listing.

- [ ] **Step 5: Verify and commit**

Run: `npm run test:rules`

Expected: all access, denial, and validation assertions pass against the Firestore emulator.

```bash
git add firestore.rules firestore.indexes.json tests/rules package.json
git commit -m "security: enforce owner and public snapshot rules"
```

### Task 9: End-to-End Verification and Firebase Deployment Documentation

**Files:**
- Create: `e2e/auth-and-publishing.spec.ts`
- Modify: `README.md`, `.env.example`, `firebase.json`
- Modify: implementation files only where verification reveals defects

**Interfaces:**
- Consumes: complete Phase 2 application and Firebase emulators.
- Produces: repeatable local verification, setup, deployment, and owner-provisioning workflow.

- [ ] **Step 1: Add emulator bootstrap and E2E fixtures**

Create one owner Auth user, one unauthorized user, and isolated Firestore test data without production credentials. Tests must clean only emulator data.

- [ ] **Step 2: Implement browser flows**

Cover owner login, reset request, local migration, online edit/reload, offline/reconnect, conflict recovery, publish, anonymous view, unpublish, regenerate, unauthorized denial, broken photo URL, and desktop/mobile layouts.

- [ ] **Step 3: Run complete verification**

```bash
npm test -- --run
npm run test:rules
npm run lint
npm run build
npx playwright test
```

Expected: every command passes and browser tests report no unexpected console errors.

- [ ] **Step 4: Complete documentation**

Document Firebase project creation, Spark plan selection, email/password provider enablement, manual owner creation, web app configuration, `.env.local`, emulator commands, Firestore Rules/index deployment, Firebase Hosting deployment, migration behavior, public-link risk, quota monitoring, and future invite boundary.

- [ ] **Step 5: Deploy only after explicit user authorization**

```bash
firebase login
firebase use <project-id>
firebase deploy --only firestore:rules,firestore:indexes,hosting
```

Do not invent `<project-id>` or deploy to an unconfirmed Firebase project.

- [ ] **Step 6: Final commit**

```bash
git add e2e README.md .env.example firebase.json src tests package.json package-lock.json
git commit -m "test: verify Firebase publishing phase"
```

## Plan Self-Review

- Tasks 1–9 cover every section of the approved specification.
- Auth, private repository, synchronization, migration, publication, anonymous rendering, Rules, emulators, and deployment remain independently testable boundaries.
- Public readers use only `publicTrees/{publicId}` paths; no task grants anonymous access to private `trees` documents.
- The public-ID lifecycle consistently uses create-before-disable for regeneration and disable-before-cleanup for unpublishing.
- Member roles remain stored but cannot authorize editor writes in Phase 2.
- Production deployment requires a user-confirmed Firebase project and explicit authorization.
