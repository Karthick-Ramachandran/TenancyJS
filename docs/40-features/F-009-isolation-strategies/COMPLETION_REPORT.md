# Completion Report: Isolation Strategies

## Status

Complete locally. Runtime strategy delivery is complete across the supported adapters, and F-012/
ADR-0029 supplies provisioning/migration orchestration through host-owned hooks.

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
- Added Prisma 7 schema-bound driver routing, TypeORM/Sequelize schema and database bindings, and
  Mongoose database routing without duplicating the shared engine/cache.

## Tests Run

- Focused shared-engine unit suite — 22/22 passed.
- Focused PostgreSQL 17 hardening suites — 15/15 passed across schema placement, restricted-role state
  reversion, and all three database-per-tenant bindings.
- Full PostgreSQL/MySQL/MongoDB `pnpm check` — passed: lint, formatting, typecheck, 587 tests, coverage,
  all 15 package archives/consumers, and Persist Doctor.
- Final coverage: 95.31% statements, 91.32% branches, 97.51% functions, 95.52% lines.
- `pnpm audit --audit-level high` — passed; one moderate advisory remains below the configured gate.
- Website production build passed with all capability, strategy, adapter, and Nest guides compiled.

## Results

- Knex/Lucid `schemaPerTenant` capabilities are promoted to `supported` for the adapter-enforced tier.
- Prisma, TypeORM, and Sequelize PostgreSQL schema/database cells, Prisma MySQL database routing, and
  Mongoose MongoDB database routing are promoted only after their real colliding-ID tests passed.
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
- Hosted CI and actually-published-package consumption remain external release evidence.
