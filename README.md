# Heritg — Family Tree MVP

A responsive, local-first family-tree workspace inspired by Heritg. Build multiple family trees, add relatives in any direction, navigate an interactive canvas, search people, protect visible details, and move trees between browsers with `.heritg` files.

The project includes a ready-to-explore `Keluarga Joko Widodo` demo tree spanning grandparents through grandchildren. The seed uses public biographical information and can be edited like any other local tree.

## Features

- Multiple editable family trees with automatic local persistence.
- Parent, partner, and child relationships with cycle prevention.
- Interactive canvas with pan, zoom, fit, selection, and relationship lines.
- Person profiles with dates, notes, gender, and locally stored photos.
- Searchable people directory and privacy masking.
- Validated `.heritg` import and export.
- Responsive desktop, tablet, and mobile layouts.
- Honest placeholders for the future Share and Family+ collaboration release.

## Run locally

Requires Node.js 20 or newer and npm.

```bash
cp .env.example .env.local
npm install
npm run dev
```

Open the local URL printed by Next.js, normally [http://localhost:3000](http://localhost:3000). If that port is occupied, Next.js selects another available port.

## Environment variables

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_APP_URL` | No | `http://localhost:3000` | Public base URL for canonical and Open Graph metadata. |

There are no API keys or server-side secrets in the MVP. Never commit `.env.local` or production credentials.

## Quality checks

```bash
npm test -- --run
npm run lint
npm run build
npm start
```

`npm start` serves the production build after `npm run build`.

## Project structure

- `src/app/` — Next.js shell, metadata, and global design tokens.
- `src/features/tree/model.ts` — family types, relationship rules, import/export validation, and deterministic layout.
- `src/features/tree/demoData.ts` — public demo family-tree seed.
- `src/features/tree/useWorkspace.ts` — hydration, autosave, and local persistence.
- `src/features/tree/Workspace.tsx` — workspace composition and accessible editing flows.
- `src/features/tree/workspace.module.css` — desktop, tablet, mobile, and reduced-motion presentation.
- `docs/superpowers/` — approved design specification and implementation plan.

## Local data and backups

Family data is automatically stored in the current browser profile. It is not uploaded, encrypted, synchronized, or recoverable from another device. Use **Family trees → Export current tree** to create a `.heritg` backup. Import validates the file before adding it as a separate tree.

Uploaded photos are stored as browser data URLs and are limited to 3 MB per source image. Browser storage limits still apply.

To reset everything, open **Settings → Reset local archive**. This only affects the current browser profile.

## MVP boundary

The purple Family+ action and Share action intentionally explain that collaboration, accounts, permissions, and cross-device synchronization belong to the next release. They do not perform fake sharing or upload local family information.
