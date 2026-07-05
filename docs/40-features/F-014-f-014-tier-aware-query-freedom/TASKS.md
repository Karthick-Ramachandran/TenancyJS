# Tasks: Tier-Aware Query Freedom

## T1: database-per-tenant full freedom (reference: Knex)

Status: Done (2026-07-05)

Scope: resolve `database-enforced` for db-per-tenant; expose the leased tenant connection to the
callback; adversarial two-tenant test running a raw query + join + nested read proving no leak; flip
Knex db-per-tenant `rawQueries`/`nestedReads`/`nestedWrites` capability. Independent review.

Delivered: `client.unrestricted()` on the protected Knex client returns the raw tenant-scoped
transaction (full joins/raw SQL/nested queries) and is gated on an explicit `databaseEnforced` flag
that `run()` sets `true` ONLY on the leased per-tenant-connection path (`databasePerTenant` AND
`mode === "tenant"`) — never on the strategy string. `knexCapabilities(strategy)` flips
`nestedReads`/`nestedWrites`/`rawQueries` to `supported` only for `databasePerTenant`. Adversarial
Postgres tests (colliding primary key across two tenant databases) prove raw + join stay isolated;
gate tests prove `unrestricted()` throws in row-level, schema-per-tenant, and db-per-tenant **central
mode**. Independent adversarial review found a HIGH (gate keyed on strategy leaked in central mode
via the shared admin connection) — fixed with the `databaseEnforced` flag and locked with a
central-mode gate test; re-review confirmed closed. See LESSONS.md and ADR-0033.

## T2: extend db-per-tenant freedom to Lucid, Prisma, TypeORM, Sequelize, Drizzle, Mongoose

Status: Todo

## T3: PostgreSQL row-level + forced RLS full freedom

Status: Todo

## T4: schema-per-tenant + per-tenant role full freedom

Status: Todo

## T5: capability matrix + docs (Limitations, adapters) reflect per-tier freedom

Status: Todo
