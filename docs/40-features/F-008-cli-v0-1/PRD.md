# PRD: CLI v0.1

## Purpose

F-005 shipped a deterministic, argv-only CLI (`init`, `doctor`, `test:leak`) that scaffolds and
diagnoses a single Express + Prisma stack. It deliberately deferred interactive prompts, more stacks,
and any tenant operations. F-008 grows `@tenancyjs/cli` toward the v0.1 catalog in `docs/CLI-RESEARCH.md`
so setup requires almost no hand-written code and the CLI is honest about what it supports.

The product owner's UX direction: the CLI must be **helpful, not forceful**. When `init` cannot confirm
the stack, it must **ask** (mandatory selection) rather than fail and demand a `--force`/`--framework`
flag; errors must be friendly; and `init` must state up front **what works, what does not, and the
required Node version**.

## In Scope

### Phase A — `init` UX (this slice)
- A capability + Node banner printed by `init`: supported stacks, unsupported stacks, and Node >= 24
  (checked, with a friendly stop below 24).
- Framework as a **mandatory interactive selection** when it cannot be auto-detected/confirmed;
  ORM derived from framework (AdonisJS -> Lucid, Express/Next.js -> Prisma). Zero new runtime
  dependency — prompts use Node's built-in `readline/promises`, injected through `CliIo` for testability.
- Flags remain the non-interactive escape hatch (`--framework`, `--yes`); `--json` and non-TTY never
  prompt and, when required info is missing, emit a friendly error naming the exact flag.
- Add a **Next.js + Prisma** `init` template (integration-next is shipped and tested but init could not
  scaffold it).
- Friendly, human error messages across the CLI while preserving machine `code` fields under `--json`.

### Phase B — operational engine (later slice, ADR-gated)
- `list`, `create` (tenant registry CRUD), `migrate` / `migrate:central` (ORM delegation), `run`
  (execute inside `runWithTenant`), and `install` (alias of `init`).

## Non-Goals

- Provisioning/deprovisioning, `seed`, `domain:*`, `pending:*`, maintenance, storage — post-v0.1.
- ORMs/frameworks beyond Express 5.2 + Prisma 7.8, AdonisJS 7.3 + Lucid 22.4, Next.js + Prisma 7.8.
- MongoDB (non-goal for the whole project).
- A prompt-library dependency, AST edits to existing files, `.env` mutation, telemetry, or network I/O
  beyond the explicit ORM-delegation subprocesses in Phase B.
