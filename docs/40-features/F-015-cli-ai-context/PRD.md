# PRD: CLI AI Context

## Purpose

TenancyJS is deliberately a bring-your-own-orchestration library: the happy path after scaffolding
(classify models, wire the resolver, run inside a tenant scope, provision/migrate) lives in docs, not
in generated code. Consumers — and increasingly the AI assistants working in their repos — lack a
local, stack-specific reference to that happy path, so they miss the fail-closed rules and reinvent
wiring. This feature lets `tenancyjs-cli init` optionally drop a stack-specific `TENANCY.md` and register a
TenancyJS block in an existing `AGENTS.md`/`CLAUDE.md`, so both humans and coding agents get the right
commands, wiring notes, and the non-negotiable "unscoped access throws — never work around it" rule.

## In Scope

- A stack-specific `TENANCY.md` (framework + ORM) written at the project root: install line, everyday
  `tenancy` commands, wiring notes per framework/ORM, isolation model, and doc links.
- An idempotent `<!-- tenancyjs:start -->…<!-- tenancyjs:end -->` block injected into any existing
  `AGENTS.md`/`CLAUDE.md` (replace-in-place on re-run; append if the markers are absent).
- Opt-in only: an interactive yes/no prompt during `tenancyjs-cli init --apply`, or the `--ai-context` flag
  for non-interactive/CI use. Nothing is written without confirmation.
- Path-safety parity with the rest of init: contained relative paths, symlink rejection, fail-closed.

## Non-Goals

- No network access — the CLI stays offline; `TENANCY.md` is generated from a local template, not
  downloaded.
- Never create an `AGENTS.md`/`CLAUDE.md` that is not already present (print the block instead).
- Never overwrite a divergent existing `TENANCY.md` (report it as skipped/left unchanged).
- No standalone `tenancy guide` command in this iteration — the trigger is init only.
