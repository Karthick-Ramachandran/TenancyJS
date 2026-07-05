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

Status: Partly done (2026-07-05) — TypeORM, Sequelize, Mongoose, Prisma done; Drizzle + Lucid deferred (T2b).

DRY/KISS: the two identical pieces moved to `tenancyjs-core` (`tier.ts`):
`databaseEnforcedCapabilities(base)` (the nested/raw capability flip) and `unrestrictedRefusedMessage(ctx)`
(the shared refusal message). Knex was refactored onto them (no one-off). Each adapter keeps its own
error class and, critically, passes `databaseEnforced` as an explicit boolean set `true` ONLY at its
`connectionCache.lease(...)` call site (never derived from strategy/mode — that derivation was the
central-mode leak from T1).

- **TypeORM / Sequelize / Mongoose**: `client.unrestricted()` returns the leased raw resource
  (EntityManager / Sequelize instance / Connection); per-strategy caps via the core helper. Adversarial
  two-tenant colliding-id tests (raw query + join / `$lookup`) + gate tests (facade scope + db-per-tenant
  central mode).
- **Prisma**: no code change — the db-per-tenant router already returns the raw leased `PrismaClient`
  and throws for non-tenant context (stronger than the facade adapters; central-mode leak impossible).
  A capabilities flip would have no consumer (the router isn't a `TenancyAdapter`) — skipped (YAGNI).

Independent adversarial review: no CRITICAL/HIGH — the `databaseEnforced`-at-lease-site invariant holds
across all four adapters and Prisma; DRY helpers shared with no over-abstraction; tests adversarial.
One NIT fixed (tightened `unrestrictedRefusedMessage` `mode` type). See LESSONS.md / ADR-0033.

## T2b: Drizzle (binding plumbing) + Lucid (hook/ALS accessor)

Status: Todo — both need real design, not copy-paste. Drizzle hides the raw db behind its binding
abstraction (`binding.ts`); Lucid's `run()` passes no client (hook + AsyncLocalStorage). Handle as a
separate reviewed slice.

## T3: PostgreSQL row-level + forced RLS full freedom

Status: Todo

## T4: schema-per-tenant + per-tenant role full freedom

Status: Todo

## T5: capability matrix + docs (Limitations, adapters) reflect per-tier freedom

Status: Todo
