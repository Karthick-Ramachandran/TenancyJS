# Completion Report: Isolation Strategies

## Status

In progress. T1–T7 and the isolation-review hardening are implemented. Knex/Lucid schema isolation,
the optional database-enforced role tier, and Knex/Lucid/Prisma database-per-tenant routing have real
PostgreSQL evidence. Provisioning remains.

## Files Changed

- Added `tenancyjs-adapter-shared`, accepted ADR-0019, and module memory.
- Consolidated PostgreSQL RLS validation, transaction context, identifiers, and discriminator decisions.
- Added the PostgreSQL schema strategy and thin Knex/Lucid bindings.
- Added unit/security and real PostgreSQL schema isolation tests; updated capabilities and docs.
- Added ADR-0021/0022, the bounded shared tenant resource cache, and thin Knex/Lucid/Prisma bindings.
- Added the optional per-tenant PostgreSQL role tier and pooled-connection state-reversion evidence.
- Added a lifetime tenant/schema collision guard and honest deferred database-validation warnings.
- Strengthened separate-database write tests with colliding primary keys and documented the Prisma
  routed-client callback boundary.

## Tests Run

- Focused shared-engine unit suite — 22/22 passed.
- Focused PostgreSQL 17 hardening suites — 15/15 passed across schema placement, restricted-role state
  reversion, and all three database-per-tenant bindings.
- `TEST_DATABASE_URL=<PostgreSQL 17> pnpm check` — passed: lint, formatting, typecheck, 386 tests
  passed/14 MySQL-only skipped, coverage, all 11 package archives, and Persist Doctor.
- Final coverage: 97.32% statements, 93.70% branches, 98.90% functions, 97.66% lines.
- `pnpm audit --audit-level high` — no known vulnerabilities.

## Results

- Knex/Lucid `schemaPerTenant` capabilities are promoted to `supported` for the adapter-enforced tier.
- Existing row-level tests and coverage gates remain green.
- Architecture, conventions, and security reviews found no blocking drift after ADR-0019/ADR-0020 and
  the enforcement-tier documentation updates.

## Remaining Risks

- Hosted Node 24/PostgreSQL 17 CI still needs final evidence after push.
- Shared-role schema mode is not database-enforced; retained raw/base clients can bypass it.
- Database placement correctness still depends on the host resolver/factory mapping each opaque key to
  the intended separate database.
- Prisma routed clients cannot be mechanically prevented from escaping their callback; doing so is
  unsupported and documented because the cache lease ends with the callback.
- Provisioning and Prisma schema-per-tenant remain unimplemented.
