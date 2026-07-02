# Tasks: Tenancyjs Platform

Implementation tasks are ordered. Only one task should be active at a time, and each new package must
receive module memory before source is written.

## T-00: Approve Architecture And Support Policy

Status: Done — approved 2026-07-01; ADR-0001 through ADR-0003 accepted.

Scope: Review ADR-0001 through ADR-0003, initial stable matrix, Node/peer-version policy, and the
row-level-first release boundary.

Acceptance: ADRs are accepted or replaced; unresolved decisions are recorded; task T-01 is selected.

Tests: `persist doctor` has no errors; documentation links resolve.

Do Not: Begin package implementation while architecture and file-write security behavior are Proposed.

## T-01: Scaffold Monorepo And Quality Gates

Status: Done — completed 2026-07-01.

Scope: pnpm workspace, package scripts, TypeScript/build/test config, changesets, CI service skeleton,
example conventions, license, contribution/security files, and module scaffolds for active packages.

Acceptance: Fresh install, build, typecheck, unit-test, package-boundary, and `persist doctor` commands
run deterministically; no product runtime behavior is added.

Tests: Workspace smoke test, package export smoke test, clean-checkout gate run.

Evidence: `pnpm check` passes locally and from a clean temporary workspace installed with
`pnpm install --frozen-lockfile`; four workspace/export tests pass; package archive and Persist
Doctor pass; dependency audit reports no known vulnerabilities.

Do Not: Add framework/ORM dependencies to core or generate all future packages prematurely.

## T-02: Implement Core Tenant Context And Lifecycle

Status: Done — completed 2026-07-01.

Scope: Immutable context, `TenancyManager`, nested tenant/central scopes, typed errors, bootstrapper
rollback, events, and minimal config primitives.

Acceptance: AC-CORE-01 through AC-CORE-04.

Tests: Core unit/concurrency/error-injection suite on supported Node versions.

Evidence: 24 tests pass; core coverage is 100% statements/functions/lines and 94.11% branches; the
packed public API passes a fresh consumer smoke test; `pnpm check`, dependency audit, architecture,
conventions, security, and Persist reviews pass locally. Node 22/24 hosted CI is pending push.

Do Not: Add HTTP concepts, ORM query logic, mutable global state, or an implicit central fallback.

## T-03: Implement Identifiers And Core Testing Contracts

Status: Done — completed 2026-07-02 under F-002 and ADR-0006.

Scope: Resolver chain, normalized host/subdomain/header inputs, tenant-store interface, test fixtures,
and reusable core/integration contract harnesses.

Acceptance: Invalid/ambiguous/suspended tenants produce typed outcomes; resolver precedence is explicit.

Tests: Fuzz/property tests for host/header normalization and resolver-chain integration tests.

Evidence: 68 tests pass; deterministic host generation, precedence/outcome/security cases, portable
contract self-tests, three-package consumer execution, clean frozen install, audit, and Persist gates
pass. Hosted CI is pending the T-03 branch push.

Do Not: Treat extracted identifiers as authenticated tenant membership.

## T-04: Implement Prisma Adapter Contract Reference

Status: Complete through F-003; hosted Node 22/24 PostgreSQL CI passes on PR #6.

Scope: Finalize `TenancyAdapter` capabilities and implement Prisma row-level scoping.

Acceptance: AC-ADAPTER-01 and AC-ADAPTER-02 for supported Prisma operations, with explicit limitations.

Tests: Shared adapter suite against PostgreSQL, including nested writes, bulk APIs, transactions, and
raw-query escape behavior.

Evidence: 127 tests pass, including real Prisma 7.8/PostgreSQL 17 isolation, bulk, aggregate,
transaction, rollback, raw/nested/fluent rejection, and the shared adapter contract. Four-package
consumer, audit, coverage, and Persist gates pass.

Do Not: Claim operations the extension API cannot reliably intercept; fail or document them explicitly.

## T-05: Implement Express Integration And Reference Example

Status: Complete through F-004; hosted Node 22/24 PostgreSQL CI passes on PR #7.

Scope: Middleware factory, error mapping, lifecycle cleanup, Express+Prisma example, and E2E harness.

Acceptance: AC-HTTP-01 and AC-COMPAT-01 for Express+Prisma.

Tests: Supertest concurrency/error cases and two-tenant PostgreSQL E2E.

Do Not: Store tenant state on process globals or rely on response `finish` as the only cleanup path.

Delivery memory: `docs/40-features/F-004-express-integration/` and
`docs/30-modules/integration-express/`.

## T-06: Implement Safe CLI Foundation

Status: Complete through F-005; hosted Node 22/24 CI passes on PR #7.

Delivery memory: `docs/40-features/F-005-safe-cli-foundation/` and `docs/30-modules/cli/`.

Scope: Project detection, typed plan, dry-run/apply engine, path/symlink checks, conflict reporting,
secret redaction, `init`, `doctor`, and `test:leak` for Express+Prisma. Doctor inventories unextended
clients, raw/nested/relation patterns, incomplete adapter classification, and estimated migration effort.

Acceptance: AC-CLI-01 and AC-CLI-02 for the reference slice.

Tests: Fixture golden tests, repeated-apply tests, malicious paths/symlinks, interrupted writes, binary
exit codes, JSON schema, and redaction tests.

Do Not: Read `.env`, overwrite conflicting files silently, execute remote packages, or invoke a shell.

## T-07: Implement Next.js App Router Integration

Status: Complete through F-006; local gates and hosted Node 22/24 PostgreSQL evidence pass on PR #7.

Delivery memory: `docs/40-features/F-006-nextjs-integration/` and
`docs/30-modules/integration-next/`.

Scope: Route Handler and Server Action wrappers, Node server helper, validated middleware handoff,
template transforms, caching guidance, and Next+Prisma example.

Acceptance: AC-NEXT-01 and AC-COMPAT-01 for Next+Prisma.

Tests: Production build/start E2E, concurrency, action errors, forged identity hints, and cache boundaries.

Do Not: Open tenant database connections in Edge middleware or promise Pages Router support.

## T-08: Implement Knex And Lucid/Adonis Vertical Slice

Status: In progress through F-007; ADR-0010/ADR-0012 are accepted, and the Knex package boundary has
hosted Node 22/24 PostgreSQL evidence.

Scope: Knex adapter, dedicated Lucid adapter, Adonis provider/middleware/config, Japa helper, Ace CLI
wrappers, CLI template, and examples.

Acceptance: AC-ADAPTER-01 for Knex/Lucid and AC-ADONIS-01.

Tests: Knex contract suite; Adonis HTTP/Japa/Ace integration; two-tenant Lucid E2E.

Do Not: Implement Ace command logic separately from CLI services or claim Lucid from Knex tests alone.

## T-09: Implement Sequelize And NestJS Vertical Slices

Status: Todo.

Scope: Sequelize adapter, Nest dynamic module and lifecycle bridge, Nest+Prisma and Nest+Sequelize
examples, and CLI templates.

Acceptance: AC-ADAPTER-01 for Sequelize, AC-NEST-01, and AC-COMPAT-01 for both Nest slices.

Tests: Adapter suite, Nest HTTP/background execution tests, and PostgreSQL E2E.

Do Not: Depend on request-scoped providers for the core context or infer raw Express coverage.

## T-10: Add Tenant Registry And Native Operation Delegates

Status: Todo.

Scope: Registry ports, list/create, bounded iteration, local executable resolution, migration/seed
delegates, dry runs, cancellation, JSON summaries, and Ace mapping.

Acceptance: AC-CLI-03 for capability-supported data layers.

Tests: Fake executable contract tests plus disposable PostgreSQL integration tests and partial-failure
resume cases.

Do Not: Pass connection secrets as printed arguments or claim rollback parity where native tools differ.

## T-11: Add Database-Per-Tenant Capability

Status: Todo.

Scope: Connection factory/provisioning port, lifecycle integration, one proven SQL adapter path, and
then capability-gated expansion.

Acceptance: Provision, migrate, use, dispose, retry, and deprovision behavior is idempotent and
credential-safe; row-level remains default.

Tests: Real-database provisioning, pool cleanup, concurrency limits, failure injection, and recovery.

Do Not: Add schema-per-tenant or destructive defaults.

## T-12: Harden And Prepare v1

Status: Todo.

Scope: API review, peer-version CI, performance benchmarks, docs, upgrade policy, security review,
release artifacts, and compatibility-table audit.

Acceptance: All applicable acceptance criteria pass and no critical/high findings remain.

Tests: Full matrix, package tarball/binary tests, docs snippets, benchmarks, and clean-install examples.

Do Not: Promote experimental combinations solely because their packages compile.
