# Commit and PR Workflow

## Golden Rule

NEVER commit, push, or create a PR until the user explicitly says so.

## Before Committing (user said "commit")

1. Update documentation so it reflects the final implementation:
   - `docs/business-flow/` — update the flow file related to the task
   - `docs/tasks/--.txt` — add any additional requirements gathered during the session
   - `docs/context/` — create or update the context markdown document for the task
2. Do NOT commit docs that are ignored in `.gitignore`.
3. Verify the changes against:
   - Original task (`docs/tasks/--.txt`)
   - Spec
   - Plan
   - Business flow documentation
   - Context documentation
   - Code review findings
4. Make sure there are no:
   - Unnecessary changes
   - Debug code
   - Temporary files
   - Secrets
   - Unrelated refactors
   - Unused imports
   - Obvious lint/type/test issues

## Commit Message Format

Use Conventional Commits:

```
type(scope): short description

- bullet point of changes
- wrap at 72 characters

Closes #42
```

Types: `feat`, `fix`, `refactor`, `docs`, `test`, `ci`, `chore`, `perf`, `style`, `build`, `revert`

## Branch Naming

- `feat/description` — new features
- `fix/description` — bug fixes
- `refactor/description` — code restructuring
- `docs/description` — documentation
- `ci/description` — CI/CD changes

## PR Workflow

1. Ensure the branch is up to date: `git fetch origin && git checkout main && git pull origin main`
2. Create a feature branch: `git checkout -b feat/description`
3. Stage only intended files: `git add <specific files>`
4. Commit with a conventional commit message
5. Push: `git push -u origin HEAD`
6. Create the PR with `gh pr create` (title + summary + test plan)
7. Monitor CI: `gh pr checks --watch`
8. If CI fails, fix and push again (up to 3 attempts, then ask the user)
9. Merge with squash: `gh pr merge --squash --delete-branch`

## Pre-Commit Verification Checklist

- [ ] No commit made without explicit user approval
- [ ] Docs updated (business-flow, tasks, context)
- [ ] No ignored docs staged
- [ ] Changes verified against task/spec/plan/business-flow/context/review findings
- [ ] No unnecessary changes, debug code, temp files, secrets, unrelated refactors, unused imports
- [ ] Lint/type/tests pass