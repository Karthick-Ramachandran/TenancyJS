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

Status: Done (2026-07-05).

- **Lucid**: `run()` now hands the callback a `LucidScope` (chosen exposure: scope argument, backward
  compatible with existing zero-arg callbacks incl. the Adonis integration). `scope.unrestricted()`
  returns the leased tenant `TransactionClientContract`. `databaseEnforced` rides in the ALS
  `TransactionScope` so nested same-tenant scopes inherit the parent's tier (never manufactured true).
- **Drizzle**: exposed the native tx via `DrizzleSessionBinding.native`; the protected client's
  `unrestricted<TDatabase>()` returns it, gated. Generic escape hatch because the binding erases the
  concrete drizzle type (caller supplies it) — reviewer concurred this is correct, not worth threading
  generics for zero runtime safety.
- Both use the core `databaseEnforcedCapabilities` + `unrestrictedRefusedMessage`; per-strategy caps.
  Adversarial colliding-id tests + facade-scope gate + central-mode gate each (Lucid also rowLevel +
  schema gates; Drizzle also schema gate + CI-only MySQL central gate).

Independent review: CLEAN across all nine checked areas — no CRITICAL/HIGH/MEDIUM. The
`databaseEnforced`-at-lease-site invariant holds; Lucid nested inheritance provably correct; Drizzle
`native` reachable only through the gated accessor.

## T3: PostgreSQL row-level + forced RLS full freedom

Status: Deferred (Maintainer decision 2026-07-05) — not building now.

Rationale: these are the *shared-connection* tiers (unlike db-per-tenant, which is safe by construction).
`unrestricted()` here would hand back a raw handle on a connection shared across tenants, safe only if
forced RLS + a non-bypass role are exactly right — higher risk, and each needs its own reads-before-writes
adversarial-test + review cycle (ADR-0033). It is also lower value: row-level/schema+role users already
have working, safe isolation through the scoped facade; full raw freedom is ergonomics, not a capability
gap. F-014 ships at the database-per-tenant tier. Revisit only if there's real demand.

## T4: schema-per-tenant + per-tenant role full freedom

Status: Deferred (Maintainer decision 2026-07-05) — same rationale as T3 (shared connection, higher risk,
lower value). Not building now.

## T5: capability matrix + docs (Limitations, adapters) reflect per-tier freedom

Status: Todo — DOCS ARE STALE (marked, deferred per owner 2026-07-05). After T2/T2b, ALL seven adapters
support `unrestricted()` (full query freedom) in database-per-tenant, but the site still says "Knex only,
rest on roadmap." Specific edits needed:

- `website/content/docs/concepts/capability-matrix.mdx` — "Query freedom by tier" table + Roadmap: the
  "Available today" cell should list all db-per-tenant adapters (Knex/Lucid/TypeORM/Sequelize/Drizzle/
  Mongoose via `unrestricted()`, Prisma via the raw leased client), not just Knex. Drop the "In progress
  (Knex shipped)" roadmap row for adapter rollout — it's done.
- `website/content/docs/concepts/limitations.mdx` — the "Available today" callout + the raw/nested
  workaround notes say "Knex database-per-tenant"; generalize to "any adapter's database-per-tenant".
- Each `website/content/docs/adapters/*.mdx` — add a short "Full query freedom: unrestricted()" note to
  Lucid/TypeORM/Sequelize/Drizzle/Mongoose (mirror the Knex page), and note Prisma db-per-tenant already
  hands back the raw client.
- `website/content/docs/strategies/database-per-tenant.mdx` — "rolling out to the other adapters" is now
  done; update.
