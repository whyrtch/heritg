# Heritg Family Tree MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a faithful, responsive, local-first recreation of the Heritg family-tree editor whose complete MVP flow creates and manages family trees on one device.

**Architecture:** A Next.js App Router shell hosts a focused client workspace. Pure TypeScript modules own domain rules, layout, serialization, and repository contracts; React components own accessible interaction and SVG/HTML canvas rendering. IndexedDB persists versioned workspaces and a recoverable backup, while a small localStorage adapter stores non-sensitive UI preferences.

**Tech Stack:** Next.js 15, React 19, TypeScript, CSS Modules/global token CSS, Lucide React, Dexie/IndexedDB, Vitest, Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-08-29-heritg-family-tree-mvp-design.md`

## Global Constraints

- MVP data remains on the current browser; no backend, authentication, database service, collaboration, or cloud sync.
- Share and Family+ remain visible but explicitly deferred.
- TypeScript is strict and production code does not use `any`.
- The primary experience must work at 1440, 1280, 1024, 390, 375, and 360 px widths.
- All icon-only controls require accessible names and visible keyboard focus.
- Motion must respect `prefers-reduced-motion`.
- Imports are fully validated before mutating the active workspace.

---

## File Map

- `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`: app shell, metadata, font loading, and design tokens.
- `src/features/tree/domain/*`: types, commands, selectors, validation, and versioned serialization.
- `src/features/tree/layout/*`: pure deterministic family layout and path generation.
- `src/features/tree/storage/*`: IndexedDB repository, backup recovery, and photo compression.
- `src/features/tree/state/*`: reducer, actions, autosave hook, and workspace context.
- `src/features/tree/components/*`: shell, sidebar, canvas, cards, drawers, dialogs, forms, and controls.
- `src/features/tree/*.test.ts(x)`: unit and component tests beside their subjects.
- `e2e/family-tree.spec.ts`: browser-level MVP workflows and responsive checks.

### Task 1: Scaffold the Application and Visual Foundation

**Files:**
- Create: `package.json`, `package-lock.json`, `tsconfig.json`, `next.config.ts`, `eslint.config.mjs`, `vitest.config.ts`, `vitest.setup.ts`, `playwright.config.ts`
- Create: `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`
- Create: `src/components/ui/Button.tsx`, `src/components/ui/IconButton.tsx`, `src/components/ui/Dialog.tsx`
- Create: `src/components/ui/ui.module.css`

**Interfaces:**
- Produces: `Button`, `IconButton`, and `Dialog` accessible primitives used by every later task.

- [ ] **Step 1: Scaffold Next.js and install the exact dependencies**

Run:

```bash
npx create-next-app@latest . --ts --eslint --app --src-dir --use-npm --no-tailwind --import-alias '@/*'
npm install lucide-react dexie
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event @playwright/test
```

Expected: the empty repository contains a runnable strict TypeScript Next.js app and a lockfile.

- [ ] **Step 2: Add test configuration and a failing shell test**

Create `src/app/page.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import Home from "./page";

it("renders the family archive workspace", () => {
  render(<Home />);
  expect(screen.getByRole("main", { name: /family tree workspace/i })).toBeInTheDocument();
});
```

Run: `npm test -- --run src/app/page.test.tsx`

Expected: FAIL because the workspace shell is absent.

- [ ] **Step 3: Implement metadata, the shell, tokens, and UI primitives**

Use CSS custom properties for canvas/surface/brown/taupe/tan/plum colors, type scale, spacing, radii, shadows, control sizes, and breakpoints. `Dialog` must use the native `<dialog>` element or equivalent focus-managed semantics and restore focus on close.

- [ ] **Step 4: Verify the visual foundation**

Run: `npm test -- --run src/app/page.test.tsx && npm run lint && npm run build`

Expected: all commands pass and `/` renders the labeled workspace.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json tsconfig.json next.config.ts eslint.config.mjs vitest.config.ts vitest.setup.ts playwright.config.ts src/app src/components/ui
git commit -m "feat: scaffold Heritg workspace"
```

### Task 2: Implement Domain Rules and Serialization

**Files:**
- Create: `src/features/tree/domain/types.ts`
- Create: `src/features/tree/domain/factories.ts`
- Create: `src/features/tree/domain/commands.ts`
- Create: `src/features/tree/domain/selectors.ts`
- Create: `src/features/tree/domain/serialization.ts`
- Test: `src/features/tree/domain/commands.test.ts`, `src/features/tree/domain/serialization.test.ts`

**Interfaces:**
- Produces: `WorkspaceState`, `FamilyTree`, `Person`, `Relationship`, `TreePreferences`, `createInitialWorkspace()`, `addPerson()`, `updatePerson()`, `removePerson()`, `addRelationship()`, `duplicateTree()`, `serializeTree()`, and `parseTreeFile()`.

- [ ] **Step 1: Write failing domain tests**

Cover a valid three-generation family, self/duplicate relationship rejection, ancestry-cycle rejection, atomic person deletion, partner symmetry, sibling rules, tree duplication with remapped IDs, and export/import round-trip.

```ts
expect(() => addRelationship(tree, { type: "parent-child", fromPersonId: child.id, toPersonId: grandparent.id })).toThrow(/cycle/i);
expect(parseTreeFile(serializeTree(tree))).toEqual(tree);
```

Run: `npm test -- --run src/features/tree/domain`

Expected: FAIL because the modules do not exist.

- [ ] **Step 2: Define strict versioned types and factories**

Set `CURRENT_SCHEMA_VERSION = 1`; use `crypto.randomUUID()` behind an injectable `IdFactory`; store ISO timestamps; represent command errors with a typed `DomainError` code and human-readable message.

- [ ] **Step 3: Implement immutable commands and selectors**

Commands return new trees/workspaces, never mutate arguments, and enforce every domain rule in the spec. Selectors expose parents, children, partners, siblings, searchable display text, and ancestry traversal.

- [ ] **Step 4: Implement validated serialization**

`parseTreeFile(input: string): FamilyTree` parses into `unknown`, validates every nested field, rejects unsupported versions/dangling IDs/duplicates/cycles, and returns data only after complete validation.

- [ ] **Step 5: Verify and commit**

Run: `npm test -- --run src/features/tree/domain && npm run lint`

```bash
git add src/features/tree/domain
git commit -m "feat: add family tree domain model"
```

### Task 3: Implement Deterministic Family Layout

**Files:**
- Create: `src/features/tree/layout/types.ts`
- Create: `src/features/tree/layout/layoutFamily.ts`
- Create: `src/features/tree/layout/relationshipPaths.ts`
- Test: `src/features/tree/layout/layoutFamily.test.ts`

**Interfaces:**
- Consumes: `FamilyTree`, relationship selectors.
- Produces: `layoutFamily(tree, options): FamilyLayout`, where `FamilyLayout` contains `nodes`, `paths`, `bounds`, and `hiddenPersonIds`.

- [ ] **Step 1: Write failing layout tests**

Assert parents appear above children, partners share a row, siblings do not overlap, repeated runs return identical coordinates, bounds contain every node, and depth filtering reports hidden people.

- [ ] **Step 2: Implement generation assignment and family grouping**

Use deterministic ordering, fixed card dimensions/gaps from layout constants, partner grouping, subtree width measurement, and a second placement pass. Resolve disconnected people into a separate row without overlapping the main family.

- [ ] **Step 3: Generate accessible SVG paths**

Create partner connectors and orthogonal parent-child paths from placed node anchors. Do not embed relationship meaning only in color; the directory and detail panel provide textual equivalents.

- [ ] **Step 4: Verify and commit**

Run: `npm test -- --run src/features/tree/layout && npm run lint`

```bash
git add src/features/tree/layout
git commit -m "feat: add deterministic family layout"
```

### Task 4: Implement Local Persistence and Workspace State

**Files:**
- Create: `src/features/tree/storage/WorkspaceRepository.ts`
- Create: `src/features/tree/storage/IndexedDbWorkspaceRepository.ts`
- Create: `src/features/tree/storage/photo.ts`
- Create: `src/features/tree/state/workspaceReducer.ts`
- Create: `src/features/tree/state/WorkspaceProvider.tsx`
- Create: `src/features/tree/state/useAutosave.ts`
- Test: corresponding `*.test.ts(x)` files

**Interfaces:**
- Produces: `WorkspaceRepository.load()`, `.save()`, `.loadBackup()`, `.clear()`; `WorkspaceProvider`; `useWorkspace()` returning state, dispatch, persistence status, and recovery actions.

- [ ] **Step 1: Write failing reducer and repository-contract tests**

Test initialization, tree switching, command error preservation, viewport updates, debounced saves, last-known-good backup, failed-save state, and backup recovery.

- [ ] **Step 2: Implement reducer and provider**

Keep domain commands outside components. Provider hydrates once, exposes a stable dispatch API, and never overwrites loaded data with the initial state during startup.

- [ ] **Step 3: Implement IndexedDB persistence and photo compression**

Store primary and backup records transactionally. Resize uploaded images to a maximum 1024 px side and encode WebP or JPEG below a defined byte budget before returning `StoredPhoto`.

- [ ] **Step 4: Implement autosave and recovery UI state**

Debounce accepted changes, preserve in-memory state on quota errors, and expose an export-first recovery action.

- [ ] **Step 5: Verify and commit**

Run: `npm test -- --run src/features/tree/state src/features/tree/storage && npm run lint`

```bash
git add src/features/tree/storage src/features/tree/state
git commit -m "feat: persist local family workspaces"
```

### Task 5: Build the Desktop Workspace and Editing Flows

**Files:**
- Create: `src/features/tree/components/AppShell.tsx`
- Create: `src/features/tree/components/AppHeader.tsx`
- Create: `src/features/tree/components/TreeSidebar.tsx`
- Create: `src/features/tree/components/FamilyCanvas.tsx`
- Create: `src/features/tree/components/PersonCard.tsx`
- Create: `src/features/tree/components/RelationshipLines.tsx`
- Create: `src/features/tree/components/CanvasControls.tsx`
- Create: `src/features/tree/components/EmptyState.tsx`
- Create: `src/features/tree/components/PersonEditor.tsx`
- Create: `src/features/tree/components/PersonDetailsPanel.tsx`
- Create: `src/features/tree/components/workspace.module.css`
- Test: focused component tests beside components

**Interfaces:**
- Consumes: workspace context, domain commands, `layoutFamily()`.
- Produces: complete create/edit/delete and relationship-building flows on the visual canvas.

- [ ] **Step 1: Write failing interaction tests**

Test the empty state, first-person creation, add-parent/add-partner/add-child/add-sibling intents, editing, deletion confirmation, sidebar tree actions, keyboard selection, and visible domain errors.

- [ ] **Step 2: Reproduce the reference shell**

Implement the floating header, warm canvas, left tree drawer, right controls, privacy/help footer controls, plum Family+ action, and the centered Heritg empty state using the measured reference proportions.

- [ ] **Step 3: Implement canvas interaction**

Use pointer capture for pan, wheel zoom centered at the pointer, clamped transforms, fit-to-bounds, focus-person animation, click selection, and reduced-motion behavior. Ensure canvas drag does not activate from form controls or person cards.

- [ ] **Step 4: Implement person and relationship flows**

Use a single `PersonEditor` for create/edit and relationship intent. Preserve form input after validation errors and show explicit confirmation before destructive actions.

- [ ] **Step 5: Verify and commit**

Run: `npm test -- --run src/features/tree/components && npm run lint && npm run build`

```bash
git add src/app/page.tsx src/features/tree/components
git commit -m "feat: build interactive family canvas"
```

### Task 6: Complete Directory, Settings, Privacy, Import/Export, and Mobile UX

**Files:**
- Create: `src/features/tree/components/PeopleDirectory.tsx`
- Create: `src/features/tree/components/SettingsPanel.tsx`
- Create: `src/features/tree/components/ImportExportDialog.tsx`
- Create: `src/features/tree/components/DeferredFeatureDialog.tsx`
- Modify: `src/features/tree/components/AppShell.tsx`
- Modify: `src/features/tree/components/workspace.module.css`
- Test: focused component tests beside components

**Interfaces:**
- Produces: searchable focus navigation, depth controls, privacy masking, safe file flows, deferred-feature messaging, and responsive drawers.

- [ ] **Step 1: Write failing feature tests**

Test normalized search, focus callback, depth expansion, privacy masking, import failure without mutation, successful import, `.heritg` download naming, and honest Share/Family+ dialogs.

- [ ] **Step 2: Implement directory and settings**

The directory is the accessible textual alternative to canvas navigation. Focusing a hidden result temporarily expands depth and centers the person. Settings explain local-device privacy limits.

- [ ] **Step 3: Implement file import/export**

Read file text through a user-selected input, call `parseTreeFile`, show a preview/confirmation, and mutate only after acceptance. Export via a Blob URL that is revoked after download.

- [ ] **Step 4: Implement responsive behavior**

At tablet widths reduce labels and panel sizes. Below 768 px use a compact top bar, full-height drawers, reachable bottom canvas controls, touch-safe targets, and no horizontal page scroll at 360 px.

- [ ] **Step 5: Verify and commit**

Run: `npm test -- --run src/features/tree && npm run lint && npm run build`

```bash
git add src/features/tree/components
git commit -m "feat: complete local tree management UX"
```

### Task 7: End-to-End Verification, Visual Refinement, and Documentation

**Files:**
- Create: `e2e/family-tree.spec.ts`
- Create: `README.md`
- Modify: visual and component files where comparison finds discrepancies

**Interfaces:**
- Consumes: the complete application.
- Produces: reproducible quality evidence and user-facing setup documentation.

- [ ] **Step 1: Write the browser workflow**

Create a tree with a grandparent, parent/partner, and child; edit a person; reload; search/focus; export; import into a reset workspace; verify deferred Share and Family+ messaging; repeat primary navigation at 390 px.

- [ ] **Step 2: Run the complete automated suite**

Run:

```bash
npm test -- --run
npm run lint
npm run build
npx playwright test
```

Expected: all commands pass with no console errors captured by Playwright.

- [ ] **Step 3: Compare reference and implementation screenshots**

Run the app, capture `/` at 1440, 1280, 1024, 390, 375, and 360 px, and compare against the reference for typography, spacing, canvas controls, panel dimensions, shadows, alignment, empty state, hover/focus, and mobile stacking. Fix observed mismatches and repeat until stable.

- [ ] **Step 4: Write the README**

Document prerequisites, `npm install`, `npm run dev`, `npm test`, `npm run build`, the source structure, local-only data behavior, `.heritg` backup flow, and collaboration-release limitations.

- [ ] **Step 5: Final verification and commit**

Run: `git diff --check && npm test -- --run && npm run lint && npm run build && npx playwright test`

```bash
git add e2e README.md src package.json package-lock.json playwright.config.ts
git commit -m "test: verify family tree MVP"
```

## Plan Self-Review

- Every requirement in the approved spec is mapped to Tasks 1–7.
- Collaboration, accounts, cloud sync, and paid behavior remain explicitly out of MVP scope.
- Domain, layout, storage, and UI interfaces use the same type and function names throughout the plan.
- The plan contains no deferred implementation placeholders; each task ends with an independently testable result.
