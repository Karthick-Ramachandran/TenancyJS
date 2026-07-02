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

Status: In Progress — implementation and test harness complete; hosted PostgreSQL evidence pending

Scope: Dedicated Lucid transaction service, `TenantScopedModel`, hooks, relationship/quiet/bulk paths,
typed errors, matrix, and PostgreSQL tests.

Acceptance: AC-LUCID-01 and AC-LUCID-02.

Tests: Lucid model/query/relationship/pagination/quiet/bulk/direct-builder isolation tests.

Evidence: 10 unit/adversarial tests pass locally; four Lucid 22/PostgreSQL 17 tests are implemented and
skip locally without `TEST_DATABASE_URL`.

## T5: Implement Adonis Provider And Middleware

Status: Blocked on T4; ADR-0013 is accepted

Scope: Typed config, IoC bindings/provider, HTTP middleware/error mapping, and lifecycle cleanup.

Acceptance: AC-ADONIS-01.

Tests: Provider/container, resolver outcomes, concurrent HTTP, rollback, cleanup, and error tests.

## T6: Add Japa, Ace, CLI Templates, And Reference Example

Status: Todo

Scope: Japa helper/plugin, thin Ace wrappers, safe Adonis/Lucid init plan, and production example.

Acceptance: AC-ADONIS-02, AC-ADONIS-03, and AC-COMPAT-KLA-01.

Tests: Japa HTTP/plugin, Ace delegation, CLI malicious/conflict fixtures, production Adonis/Lucid E2E,
clean package consumers, and the common Node 24 CI lane.

## T7: Review And Promote Evidence

Status: Todo

Scope: Security/conventions/architecture reviews, docs/matrices/module memory, completion evidence.

Acceptance: No blocker; full gate and Persist Doctor pass; only CI-proven support is advertised.

Tests: `pnpm check`, dependency audit, clean pack consumers, production/Japa E2E, Persist Doctor.
