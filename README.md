# Heritg Family Tree MVP

A local-first recreation of the Heritg family-tree workspace. Build multiple family trees, add relatives in any direction, navigate an interactive canvas, search people, protect visible details, and move trees between browsers with `.heritg` files.

## Run locally

Requires Node.js 20 or newer.

```bash
npm install
npm run dev
```

Open the local URL printed by Next.js.

## Quality checks

```bash
npm test -- --run
npm run lint
npm run build
```

## Project structure

- `src/app/` — Next.js shell, metadata, and global design tokens.
- `src/features/tree/model.ts` — family types, relationship rules, import/export validation, and deterministic layout.
- `src/features/tree/useWorkspace.ts` — hydration, autosave, and local persistence.
- `src/features/tree/Workspace.tsx` — workspace composition and accessible editing flows.
- `src/features/tree/workspace.module.css` — desktop, tablet, mobile, and reduced-motion presentation.
- `docs/superpowers/` — approved design specification and implementation plan.

## Local data and backups

Family data is automatically stored in the current browser profile. It is not uploaded, encrypted, synchronized, or recoverable from another device. Use **Family trees → Export current tree** to create a `.heritg` backup. Import validates the file before adding it as a separate tree.

Uploaded photos are stored as browser data URLs and are limited to 3 MB per source image. Browser storage limits still apply.

## MVP boundary

The purple Family+ action and Share action intentionally explain that collaboration, accounts, permissions, and cross-device synchronization belong to the next release. They do not perform fake sharing or upload local family information.
