# Tasks: Knex, Lucid, And AdonisJS Vertical Slice

## T1: Approve Security And Lifecycle Contracts

Status: Complete — ADR-0010 and ADR-0013 accepted.

Scope: Complete F-007/module memory and review ADR-0010/ADR-0013.

Acceptance: Public boundaries, unsupported surfaces, peer versions, RLS requirements, Adonis
lifecycle, and test evidence are explicit; Persist Doctor passes.

Tests: Persist Doctor and documentation link/status review.

Do Not: Start package code before both ADRs are accepted.

## T2: Implement Knex Adapter Boundary

Status: Complete — protected boundary and unit/adversarial tests implemented.

Scope: Package/config/errors/table classification/protected builders/managed transactions/RLS
validation and operation matrix.

Acceptance: AC-KNEX-01 through AC-KNEX-03.

Tests: Unit/type/adversarial builder and RLS validation tests.

## T3: Prove Knex PostgreSQL Compatibility

Status: Complete — hosted Node 22/24 PostgreSQL 17 evidence passes on PR #8.

Scope: Shared adapter contract, generic Knex example, PostgreSQL 17 and package-consumer evidence.

Acceptance: AC-KNEX-04 and Knex portion of AC-COMPAT-KLA-01.

Tests: Two-tenant CRUD/bulk/aggregate/transaction/concurrency/rollback/bypass matrix on Node 24.

## T4: Implement And Prove Lucid Adapter

Status: Complete — hosted Node 24 CI (PostgreSQL 17 service) passes on PR #8 (commit 623045d);
AC-LUCID-01 and AC-LUCID-02 are proven against a real database.

Scope: Dedicated Lucid transaction service, `TenantScopedModel`, hooks, relationship/quiet/bulk paths,
typed errors, matrix, and PostgreSQL tests.

Acceptance: AC-LUCID-01 and AC-LUCID-02.

Tests: Lucid model/query/relationship/pagination/quiet/bulk/direct-builder isolation tests.

Evidence: 11 unit/adversarial tests pass; the four Lucid 22/PostgreSQL 17 integration tests pass
against a real PostgreSQL 17 database. Full `pnpm check` (with all DB lanes active) is green on the
hosted Node 24 CI lane on PR #8 — the advertised compatibility gate per the PRD — and was first
reproduced locally against `postgres:17-alpine` (17.10).

## T5: Implement Adonis Provider And Middleware

Status: Implemented — `@tenancyjs/integration-adonis` (typed config, provider, middleware, sanitized
error mapping) with 32 unit tests; full local gate green. Governed by ADR-0014 on the ADR-0013 Node 24
baseline. Hosted Node 24 CI evidence pending a push; real AdonisJS/Lucid/PostgreSQL end-to-end proof is
T6.

Scope: Typed config, IoC bindings/provider, HTTP middleware/error mapping, and lifecycle cleanup.

Acceptance: AC-ADONIS-01.

Tests: Provider/container, resolver outcomes, concurrent scope, rollback, cleanup, and error tests.

Evidence: 37 unit tests pass (config/errors/middleware/provider/testing/Lucid-runner compatibility).
Full `pnpm check` with all DB lanes active is green — 26 files, 298 tests, exit 0 — on local Node 26.
The real compiled-app Japa + PostgreSQL end-to-end evidence is delivered in T6. Building that example
refined the package: `defineAdonisTenancyConfig` now accepts a lazy tenancy factory (AdonisJS loads
config before providers boot), and the provider gates fail-closed policy validation to the `web`
environment (so console migrations and tests can provision the schema the check requires).

## T6: Add Japa, Ace, CLI Templates, And Reference Example

Status: In Progress — Japa helper and the reference example are complete (local); Ace wrappers and safe
CLI init templates remain.

Scope: Japa helper/plugin, thin Ace wrappers, safe Adonis/Lucid init plan, and production example.

Acceptance: AC-ADONIS-02, AC-ADONIS-03, and AC-COMPAT-KLA-01.

Tests: Japa HTTP/plugin, Ace delegation, CLI malicious/conflict fixtures, production Adonis/Lucid E2E,
clean package consumers, and the common Node 24 CI lane.

Evidence: `withTenant` helper (part 1) unit-tested. Reference example `examples/adonis-lucid`
(scaffolded from the official AdonisJS 7 `api` starter kit; kept local/gitignored/standalone) passes
4/4 Japa + `@japa/api-client` E2E against live PostgreSQL 17 with forced RLS and a non-privileged
runtime role — two-tenant isolation, tenant injection on create, and sanitized 400/404. Ace wrappers,
CLI init templates + v6→v7 fixture, and published/hosted example evidence remain. The example is
local-only for now (demos are maintained as clone-able apps, not published); see the ADONISJS_V7 note
in the module memory.

## T7: Review And Promote Evidence

Status: Todo

Scope: Security/conventions/architecture reviews, docs/matrices/module memory, completion evidence.

Acceptance: No blocker; full gate and Persist Doctor pass; only CI-proven support is advertised.

Tests: `pnpm check`, dependency audit, clean pack consumers, production/Japa E2E, Persist Doctor.
