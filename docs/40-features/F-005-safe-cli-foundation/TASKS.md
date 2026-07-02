# Tasks: Safe Cli Foundation

## T1: Plan CLI Foundation

Status: Complete.

Scope:

- Record feature/module memory and confirm ADR-0003 covers the boundary.

Acceptance:

- PRD, acceptance, architecture impact, tests, boundaries, and ordered tasks are explicit.

Tests:

- Persist Doctor.

Do Not:

- Start implementation before PRD, acceptance, architecture impact, and test plan are clear.

## T2: Implement Detection And Safe Init

Status: Complete.

Scope: Metadata detection, typed plans, templates, preview/apply, containment, symlinks, conflicts,
staging, rollback, and idempotency.

Acceptance: AC-CLI-REF-01 through AC-CLI-REF-03.

Tests: Unit, golden fixture, repeated apply, traversal, symlink, conflict, and rollback cases.

Do Not: Patch or overwrite an existing file.

## T3: Implement Doctor And Leak-Test Delegation

Status: Complete.

Scope: Static inventory, redaction, human/JSON schemas, exit codes, migration estimate, and local Node
delegation.

Acceptance: AC-CLI-REF-04 through AC-CLI-REF-06.

Tests: Findings, JSON snapshots/schema, redaction, binary exits, local Node pass/fail, and malicious
test paths.

Do Not: Read `.env`, connect to a database/network, execute project modules, a shell, or remote runner.

## T4: Package, Document, And Review

Status: Complete; hosted Node 22/24 CI passes on PR #7.

Scope: README, changeset, package consumer, root docs, reviews, completion evidence, and gates.

Acceptance: AC-CLI-REF-07 and AC-CLI-REF-08 plus platform AC-CLI-01/02 for the reference slice.

Tests: `pnpm check`, audit, binary/package verification, Persist Doctor, and hosted CI.

Do Not: Describe this foundation as migration/database-per-tenant support.
