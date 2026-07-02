# PRD: Safe Cli Foundation

## Purpose

Complete the first usable Express + Prisma vertical slice with a deterministic CLI that can inspect a
project, preview safe wiring files, apply new files without destructive edits, diagnose isolation
gaps, and run an explicit local leak test. The CLI turns the repository's fail-closed guarantees into
repeatable developer and CI checks.

## In Scope

- Publish the `tenancy` binary from `@tenancyjs/cli`.
- Detect Express 5 and Prisma 7.8 from package metadata without executing project code.
- Implement typed change plans, dry-run-by-default `init`, explicit `--apply`, conflict reporting,
  path containment, symlink rejection, staged writes, rollback, and idempotency.
- Generate new Express + Prisma row-level config/register/middleware files only.
- Implement deterministic human/JSON `doctor` checks for wiring, versions, unextended clients,
  raw/nested/relation patterns, model classification, leak-test presence, and migration effort.
- Implement `test:leak --test-file <path>` using an explicit project-local Node entry and direct
  argument-array process execution.
- Redact secrets and database URLs from all output.

## Non-Goals

- Interactive prompts, existing-file AST transforms, overwrite/force mode, or `.env` mutation.
- Database connectivity, migrations, seeds, tenant CRUD, or database-per-tenant operations.
- Frameworks/ORMs beyond Express 5.2 and Prisma 7.8.
- Remote packages, shell commands, telemetry, network diagnostics, or implicit project-code evaluation;
  only the explicit `test:leak` file is executed.
