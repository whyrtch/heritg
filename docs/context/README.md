# Context Documentation

This directory preserves implementation context between AI sessions.

Conventions:
- One markdown file per task/feature
- Name files descriptively, e.g. `2026-09-16-order-payment.md`
- A future AI agent must be able to read the context document and understand:
  - What was requested and why
  - What was changed
  - How frontend and backend communicate
  - Which files are involved
  - Which technical decisions were made
  - What has been completed and what still needs to be done
- Do not copy entire source code into context documents; prefer references to file paths, functions, components, hooks, services, repositories, endpoints, and database tables
- Read the relevant context document before continuing an existing task
- Update the context document whenever implementation, business flow, API contract, architecture, database structure, requirements, or known limitations change