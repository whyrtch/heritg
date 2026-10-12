@AGENTS.md

# Claude Code specifics

## Sub-agents

The roles in AGENTS.md are defined as Claude Code sub-agents in `.claude/agents/`, each pinned to its model:

| Sub-agent | File | Model |
|---|---|---|
| `planner` | `.claude/agents/planner.md` | `claude-opus-5-5` |
| `reviewer` | `.claude/agents/reviewer.md` | `claude-opus-5-5` |
| `implementer` | `.claude/agents/implementer.md` | `claude-sonnet-5-5` |
| `designer` | `.claude/agents/designer.md` | `claude-sonnet-5-5` |
| `docs-writer` | `.claude/agents/docs-writer.md` | `claude-sonnet-5-5` |
| `verifier` | `.claude/agents/verifier.md` | `claude-haiku-5-5` |
| `explorer` | `.claude/agents/explorer.md` | `claude-haiku-5-5` |

## How the main session should delegate

- **Brainstorming and planning must run on Opus 5.5.** If the main session is not running Opus 5.5, delegate brainstorming, spec writing, and plan writing to the `planner` sub-agent instead of doing it inline. Don't pass a `model` override that changes this.
- Executing an approved plan: one `implementer` per task. Run independent tasks in parallel with `isolation: "worktree"`; keep tasks that share files sequential.
- After each implementer finishes: spawn `verifier`. Before declaring a branch ready: spawn `reviewer` (always for `src/server/**`, `src/app/api/**`, `src/features/auth/`, `src/features/tree/{repository,sync,migration,publishing}/`).
- Use `explorer` for broad read-only searches instead of reading many files in the main context.
- Use `designer` for Figma MCP work; it must batch calls because of the Starter-plan limit.
- Multi-agent `Workflow` scripts are only run when the owner explicitly asks for one; otherwise use the Agent tool with these sub-agents.

## Skills

- `frontend-design` — load before any visual/UI work. The skill is committed at `.agents/skills/frontend-design/` (pinned in `skills-lock.json`). `.claude/skills/` holds a local link to it and is git-ignored; if it is missing after a fresh clone, run `npx skills add https://github.com/anthropics/skills --skill frontend-design` (or read `.agents/skills/frontend-design/SKILL.md` directly).
