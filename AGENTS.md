# Heritg — Agent Guide

Heritg is a personal, online family-tree archive. One owner signs in with email and password, edits trees stored in PostgreSQL through the app's own Next.js API (with an offline browser cache), and can publish a revocable unlisted read-only link per tree. See `README.md` for setup and data layout.

This file is the shared brief for every coding agent (Claude Code, Codex, Gemini CLI, Copilot, etc.). `CLAUDE.md` imports it and adds Claude-specific multi-agent wiring.

## Commands

```bash
npm run dev            # Next.js dev server (http://localhost:3000); needs DATABASE_URL
npm test -- --run      # Vitest unit + component tests (must pass)
npm run test:api       # API, authorization and database tests on in-process PostgreSQL (PGlite) (must pass)
npm run lint           # ESLint (must pass)
npm run build          # Production build (must pass before a PR)
npm run db:generate    # SQL migration after changing src/server/db/schema.ts
npm run db:migrate     # apply migrations to DATABASE_URL
npm run owner:create   # create the owner account (no public registration)
npm run owner:reset-password  # reset the owner password on the server (signs out every device)
npm run migrate:firestore     # one-time Firebase import (only with explicit owner approval; see README)
```

Local database: `docker compose up -d`, then `DATABASE_URL=postgres://heritg:heritg@localhost:5432/heritg` in `.env.local`.

## Stack and layout

Next.js 15 (App Router, Route Handlers) · React 19 · TypeScript · CSS Modules · PostgreSQL + Drizzle ORM · Argon2id + database sessions · Zod · Vitest + Testing Library · lucide-react.

- `src/app/` — routes: `/` workspace, `/login`, `/tree/[publicId]` public read-only view; `src/app/api/**` thin Route Handlers.
- `src/server/` — server-only code: `db/` (schema, client), `auth/`, `trees/`, `publications/`, `photos/`, `migration/`. Never imported from client code (ESLint enforces it; `server-only` guards it too).
- `src/features/auth/` — session state, owner guard, safe error messages.
- `src/features/tree/model.ts` — local domain model and pure helpers (relationships, import/export).
- `src/features/tree/{domain,repository,sync,migration,publishing,canvas,dialogs}/` — online model, HTTP/local repositories, offline sync + photo queue, browser-tree migration, unlisted publishing, SVG canvas, dialogs.
- `src/features/tree/Workspace.tsx` — main workspace UI (dense, single file).
- `drizzle/` — SQL migrations. `tests/api/` — authorization and database tests.
- `docs/superpowers/specs/` — approved designs. `docs/superpowers/plans/` — step-by-step implementation plans.

## Hard rules

- **The security boundary is the server.** Every tree, photo and publication query in `src/server/**` is scoped to the session owner; another owner's data must look exactly like missing data (404). Database CHECKs and foreign keys back up the Zod validation. Any change to `src/server/**`, `src/app/api/**`, auth, sync, migration or publishing needs matching `tests/api/` (or unit) coverage and a review (see Multi-agent workflow). The only unauthenticated routes are `POST /api/auth/login`, `GET /api/auth/session` and the public snapshot reads (`/api/public/:publicId` and its photos); never add another, and never make public data listable.
- **State-changing requests** keep the exact-origin check (`APP_URL`) and the `__Host-` HttpOnly session cookie; never store session tokens or secrets in browser storage.
- **No deploys.** Never deploy, run migrations against production, or touch production data without explicit owner approval in chat. Never run `npm run migrate:firestore` against real data without explicit approval.
- **Public snapshots and public photos** never contain owner id, email or session data.
- **Never weaken login protection:** Argon2id hashing, neutral login errors, the per-address and per-account login limits, and session expiry/rotation.
- **Never delete local user data** in migration/sync code paths.
- **Public pages** stay read-only: no buttons, no "edit" wording (`PublicTree.test.tsx` guards this), `noindex, nofollow`.
- **Photos** are HTTPS links or uploaded thumbnails only (owner decision 2026-10-11): JPEG/WebP, at most 256 px and 48 KB, shrunk in the browser and checked again on the server by magic bytes and size. They are stored in PostgreSQL and never travel inside a tree save.
- Keep accessible names that tests assert (see the relevant plan's Global Constraints) unless the plan changes them together with the test.
- Don't commit secrets: `DATABASE_URL`, service-account keys and data exports stay out of Git (`.gitignore` covers the usual names).

## Conventions

- Match the surrounding code: compact components, CSS Modules, design tokens from `src/app/globals.css` (no new hardcoded hex colors once the Mori & Tarum tokens land).
- Pure logic goes in `model.ts` / `domain/` with unit tests; UI stays thin.
- Conventional commit prefixes, as in history: `feat:`, `fix:`, `style:`, `refactor:`, `docs:`, `security:`, `chore:`, `test:`. One task from a plan = one commit.
- Commit or push only when the owner asks. Branch off `main` for work.
- Work from plans: brainstorm → spec (`docs/superpowers/specs/YYYY-MM-DD-*-design.md`) → plan (`docs/superpowers/plans/YYYY-MM-DD-*.md`) → implement task by task, ticking checkboxes.

## Design

- Visual source of truth: Figma file https://www.figma.com/design/h7ZwKUiWepibq9xA1pLNIK (pages *Foundations & Components* and *Screens*; Screens is a Desktop 1440 / Tablet 768 / Mobile 390 matrix).
- Current direction: **Mori & Tarum** — spec `docs/superpowers/specs/2026-10-11-mori-tarum-visual-redesign-design.md`, implementation plan `docs/superpowers/plans/2026-10-11-mori-tarum-ui-implementation.md`.
- Load the `frontend-design` skill (`.agents/skills/frontend-design/SKILL.md`) before visual work.
- Figma MCP runs on a Starter plan with a small call budget: batch work into few large `use_figma` calls and screenshot only once per change.

## Multi-agent workflow

Work is split by role. Each role has a fixed model chosen for the kind of thinking it needs. **Brainstorming and planning always run on Claude Opus 5.5 (`claude-opus-5-5`).**

| Role | Model | Use for | Writes to |
|---|---|---|---|
| **planner** | `claude-opus-5-5` | Brainstorming, product/UX options, architecture, specs, implementation plans, breaking work into tasks, re-planning after a blocker | `docs/superpowers/specs/`, `docs/superpowers/plans/` only |
| **reviewer** | `claude-opus-5-5` | Code review before merge; mandatory for server/API, auth, sync, migration, publishing changes | nothing (reports findings) |
| **implementer** | `claude-sonnet-5-5` | Executing one plan task at a time: code + tests | `src/`, `tests/`, config named by the task |
| **designer** | `claude-sonnet-5-5` | Figma work via MCP and CSS polish following an approved design spec | Figma file; `*.module.css`, `globals.css` |
| **docs-writer** | `claude-sonnet-5-5` | README, runbooks, release notes, updating plan checkboxes | `README.md`, `docs/` |
| **verifier** | `claude-haiku-5-5` | Running test/test:api/lint/build and reporting pass/fail with output | nothing |
| **explorer** | `claude-haiku-5-5` | Fast read-only codebase lookups ("where is X", "who calls Y") | nothing |

Why these models: Opus 5.5 handles open-ended reasoning, trade-offs and risk review; Sonnet 5.5 is the cost-efficient workhorse for well-specified coding and design execution; Haiku 5.5 is cheapest and fastest for mechanical runs and lookups.

### Flow

1. **Brainstorm / plan (planner, Opus 5.5).** Any new feature, redesign, or unclear request starts here. Output is a spec and/or plan file with checkbox tasks, file ownership per task, and acceptance checks. The owner approves before implementation.
2. **Implement (implementer, Sonnet 5.5).** One task per agent run. Independent tasks that touch disjoint files may run in parallel, each in its own git worktree; tasks that touch the same file run sequentially.
3. **Verify (verifier, Haiku 5.5).** After each task: `npm test -- --run` and `npm run lint`; add `npm run test:api` when `src/server/**`, `src/app/api/**` or repositories changed, and `npm run build` before a PR.
4. **Review (reviewer, Opus 5.5).** Before merge, and always for security-sensitive areas. Findings go back to an implementer.
5. **Docs (docs-writer, Sonnet 5.5).** Tick plan checkboxes, update README/specs if behavior or setup changed.

### Rules for orchestration

- If a task turns out bigger or different than planned, stop and send it back to the **planner** — implementers do not redesign.
- Give each sub-agent a self-contained prompt: the plan path and task number, the files it owns, and the commands that must pass.
- Never run two agents that edit the same file at the same time.
- Agents report outcomes faithfully: failing output is quoted, skipped steps are named.
