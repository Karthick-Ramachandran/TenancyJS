# Completion Report: Isolation Strategies

## Status

In progress. T1–T4 are implemented locally: schema isolation is gate-green and the
database-per-tenant cache foundation is finished. ORM database bindings, hosted CI/merge, roles, and
provisioning remain.

## Files Changed

- Added `@tenancyjs/adapter-shared`, accepted ADR-0019, and module memory.
- Consolidated PostgreSQL RLS validation, transaction context, identifiers, and discriminator decisions.
- Added the PostgreSQL schema strategy and thin Knex/Lucid bindings.
- Added unit/security and real PostgreSQL schema isolation tests; updated capabilities and docs.
- Added ADR-0021 and the bounded shared tenant resource cache; no adapter capability was flipped.

## Tests Run

- `pnpm typecheck` — passed.
- Focused unit suites — 101/101 passed before schema binding; updated adapter/shared suites pass.
- PostgreSQL 17 focused suites — 11/11 passed after adversarial mutation and default-path shadow assertions.
- `pnpm test:run` without DB variables — 308 passed, 44 skipped; coverage 96.23% statements, 92.01%
  branches, 98.08% functions, 96.56% lines.
- `TEST_DATABASE_URL=<PostgreSQL 17> pnpm check` — passed: lint, formatting, typecheck, 343 tests
  passed/14 MySQL-only skipped, coverage, 11 package archives, and Persist Doctor.
- Final coverage: 97.11% statements, 93.42% branches, 98.81% functions, 97.43% lines.
- `pnpm audit --audit-level high` — no known vulnerabilities.
- Cache-foundation `pnpm check` — 322 passed/45 database-environment skips; 96.35% statements, 92.09%
  branches, 98.19% functions, 96.77% lines; 11 package archives passed. The initial Doctor run caught
  completion-status wording and was rerun after correction.

## Results

- Knex/Lucid `schemaPerTenant` capabilities are promoted to `supported` for the adapter-enforced tier.
- Existing row-level tests and coverage gates remain green.
- Architecture, conventions, and security reviews found no blocking drift after ADR-0019/ADR-0020 and
  the enforcement-tier documentation updates.

## Remaining Risks

- Hosted Node 24/PostgreSQL 17 CI still needs final evidence after push.
- Shared-role schema mode is not database-enforced; retained raw/base clients can bypass it.
- Provisioning, per-tenant roles, database-per-tenant, and Prisma schema cache remain unimplemented.
- The shared cache is implemented, but connected-database identity validation and ORM bindings remain
  before database-per-tenant can be advertised.
