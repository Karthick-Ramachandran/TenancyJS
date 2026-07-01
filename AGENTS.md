# tenancyjs Agent Instructions

This repository uses Persist OS repository memory. Durable memory under `docs/` is the source of
truth over chat history; repository rules override model preference. If an instruction conflicts with
repository memory, stop and report it.

## Rules — follow on every change

- Read the Required reading below before non-trivial work.
- Match ceremony to scope — both ways. A genuinely new feature, module, integration, data model, or
  security/architecture decision gets proper planning (PRD/plan/ADR as fit) — do not under-build it.
  A small addition or fix within an already-decided area (a component, helper, endpoint, bug fix)
  just gets implemented with focused tests — no planning docs. Judge by novelty and blast radius, not
  line count: a one-button change inside an existing feature is small; building that feature is not.
- Record substantial work with the persist CLI so the memory actually exists — a new feature →
  `persist feature create <name>` (then fill its PRD and acceptance); a real decision (a dependency,
  data model, auth/security choice, API shape) → `persist adr create <title>` then
  `persist adr accept <name>`. Reasoning left only in the chat is gone next session — if it is not in
  a file, it did not happen.
- Reuse what `docs/60-engineering/CONVENTIONS.md` names. Never reinvent a component, helper, client,
  type, or pattern it lists; when you make a new reusable one, add it there.
- When something breaks non-obviously, add a one-line entry to `docs/60-engineering/LESSONS.md`.
- Never contradict an accepted ADR in `docs/adrs/`. To change one, confirm with a human and run
  `persist adr supersede <old> <new-title>` — never overwrite an accepted decision.
- Before claiming work complete, run `persist doctor` and fix every error. Never claim "done" without
  test evidence.
- Run the `persist` CLI yourself; never ask the human to run it or web-search this project-local tool.

## Required reading

- `docs/00-product/PRD.md`
- `docs/10-architecture/ARCHITECTURE.md`
- `docs/20-security/SECURITY_MODEL.md`
- `docs/50-quality/QUALITY_GATES.md`
- `docs/60-engineering/ENGINEERING_STANDARDS.md`
- `docs/60-engineering/CONVENTIONS.md`
- `docs/60-engineering/LESSONS.md`

## Persist commands

- `persist doctor` — validate repository memory; run before claiming work complete.
- `persist feature create <name>` — scaffold feature memory before non-trivial feature work.
- `persist adr create <title>` then `persist adr accept <name>` — propose, then accept, a decision.
- `persist adr supersede <old> <new-title>` — record a changed decision (never overwrite an accepted ADR).
- `persist module create <name>` — scaffold module memory for a new responsibility boundary.
- `persist mcp add <server>` — capture an MCP tool's context into memory, offline.

Full reference: `docs/ai/PERSIST_COMMANDS.md`.
