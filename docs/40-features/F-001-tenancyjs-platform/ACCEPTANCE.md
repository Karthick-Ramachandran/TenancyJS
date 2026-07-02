# Acceptance Criteria: Tenancyjs Platform

## Criteria

- AC-CORE-01: Concurrent and nested `runWithTenant` calls preserve the correct immutable tenant and
  restore the parent or empty context after success and failure.
- AC-CORE-02: Tenant-aware access without a context throws a typed error by default; resolver failure
  never silently selects central context.
- AC-CORE-03: `runInCentralContext` is explicit, scoped, nestable, and cannot be selected from raw
  resolver input.
- AC-CORE-04: Bootstrapper setup and revert order is deterministic, with completed setup reverted in
  reverse order if any setup or user callback fails.
- AC-ADAPTER-01: Prisma, Sequelize, Knex, and Lucid adapters pass the shared row-level isolation suite
  for create, read, update, delete, bulk, count/aggregate, nested operations where supported, and
  transactions.
- AC-ADAPTER-02: Central models are allowlisted explicitly and tenant-owned models cannot be accessed
  through an unregistered or context-free path without a typed failure or documented unsafe API.
- AC-HTTP-01: Express middleware initializes tenant context only for the handler scope and cleans it
  after success, thrown errors, rejected promises, and concurrent requests.
- AC-NEXT-01: Next.js App Router wrappers support Route Handlers, Server Actions, and Node-runtime
  server execution; Edge middleware may carry only validated identity hints and never opens an ORM
  connection.
- AC-NEST-01: NestJS exposes a global/dynamic module and guard or middleware using core context; it
  supports both Express-platform applications and transport-independent explicit execution helpers.
- AC-ADONIS-01: AdonisJS exposes a provider, middleware, config stub, Japa helpers, and Ace wrappers;
  Lucid scoping uses Adonis model/query lifecycle rather than claiming generic Knex coverage.
- AC-CLI-01: `tenancy init` detects or accepts each supported framework and data layer, previews every
  write, rejects traversal/symlink escapes, reports conflicts, and is idempotent.
- AC-CLI-02: `tenancy doctor` emits human and JSON results, redacts secrets, and fails non-zero for
  missing context wiring, unsupported versions, or adapter leak-test failures.
- AC-CLI-03: Migration and seed commands delegate to locally installed native tooling with argument
  arrays, bounded concurrency, dry-run support, per-tenant results, and no credential output.
- AC-COMPAT-01: Each stable framework/data-layer combination has a versioned CI lane, runnable example,
  documented limitations, and an E2E test proving tenant A cannot observe or mutate tenant B.
- AC-DOCS-01: Quickstarts, threat model, central-vs-tenant semantics, raw-query limitations, supported
  versions, and upgrade policy are published before the first public stable claim.

## Out Of Scope

- Compatibility targets and advanced features listed as non-goals in `PRD.md`.
- Performance claims beyond a benchmark harness until representative measurements exist.
- Automatic acceptance of future proposed ADRs; architecture decisions require review before their
  implementation starts.

## T-02 Evidence

AC-CORE-01 through AC-CORE-04 are implemented in `@tenancyjs/core` and covered by concurrency,
nesting, central-scope, fail-closed, bootstrap failure, reverse cleanup, lifecycle error, and packed
consumer tests.

## T-03/T-04 Evidence

Tenant identification and portable lifecycle contracts are implemented through F-002. Prisma's
portion of AC-ADAPTER-01 and AC-ADAPTER-02 is implemented through F-003 for the explicit Prisma
7.8/PostgreSQL top-level operation matrix, shared adapter contract, transactions, central models,
and typed raw/nested rejection. Other adapters remain pending; Express evidence is recorded below.

## T-05 Local Evidence

AC-HTTP-01 passes locally through F-004 for Express 5.2 success, thrown/rejected routes, finish/close,
real client abort, and concurrent tenant requests. The Express + Prisma/PostgreSQL reference E2E proves
two-tenant read/create/update/delete/count/aggregate isolation. Hosted Node 22/24 PostgreSQL CI passes
on PR #7, completing the reference slice evidence for AC-COMPAT-01.

## T-06 Local Evidence

AC-CLI-01 and AC-CLI-02 pass locally for the Express + Prisma reference slice through F-005: safe
new-file-only init preview/apply, conflict/path/symlink/rollback controls, deterministic human/JSON
Doctor inventory and migration effort, redaction, exit codes, and explicit bounded leak-test execution.
Migration/seed delegation under AC-CLI-03 remains a later task.
