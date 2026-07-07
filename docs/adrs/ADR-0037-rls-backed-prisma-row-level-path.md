# ADR-0037: RLS Backed Prisma Row Level Path

## Status

Accepted

## Context

Prisma row-level isolation is **facade-only**. The adapter is a Prisma Client `$extends` query
extension that rewrites query arguments — it AND-composes a tenant predicate into every `where`, injects
the discriminator on create, and rejects raw/relation operations. It sets **no** PostgreSQL session
state: a grep for `set_config` / `SET LOCAL` / `current_setting` across `packages/adapter-prisma/src`
returns nothing. So a query that ever slips the extension has no database net.

Every other PostgreSQL SQL adapter (Knex, Lucid, and via the shared engine TypeORM/Sequelize/Drizzle)
runs under **forced RLS**: `applyPostgresRowContext` sets `tenancyjs.tenant_id` transaction-locally and
`validatePostgresRlsPolicies` enforces the policy contract at startup, so the database itself refuses
cross-tenant rows. Prisma — the most widely used ORM in this ecosystem — is the one Postgres path with
no such backstop. External review correctly flagged this as the weakest point in the security story,
because it is weakest exactly where adoption is highest. Prisma 7 with driver adapters
(`@prisma/adapter-pg`) and interactive transactions now makes a per-transaction `SET LOCAL` feasible,
which was the historical blocker.

## Decision

Add an **RLS-backed Prisma row-level path** on PostgreSQL that lifts Prisma to the same
database-enforced tier as the other adapters. Introduce it opt-in, then make it the default on Postgres
once proven.

- **Transaction-scoped GUC.** The adapter's scoped unit of work runs inside a Prisma interactive
  transaction. At the top of that transaction it issues `SELECT set_config('tenancyjs.tenant_id', $1,
  true), set_config('tenancyjs.is_central', $2, true)` via `$executeRaw`, so every statement in the
  scope — including any that bypass the extension — is filtered by the RLS policy. `SET LOCAL` is
  transaction-local, so it is pool-safe.
- **Defense in depth, not replacement.** The existing where-injection extension stays on as the facade
  layer; forced RLS becomes the backstop beneath it. Both must agree.
- **Startup validation.** Reuse `validatePostgresRlsPolicies` from `adapter-shared` so a Prisma
  deployment fails closed at startup unless `FORCE ROW LEVEL SECURITY`, a non-`BYPASSRLS` runtime role,
  and a valid `<table>_tenant_isolation` policy are all present — identical to Knex/Lucid.
- **Capabilities reflect the tier.** An RLS-backed Prisma row-level scope reports as database-enforced;
  this is the precondition that lets ADR-0038 grant it query freedom. The current facade-only path
  remains available and clearly labeled for non-Postgres or non-driver-adapter setups.

## Alternatives Considered

- **Keep facade-only + louder warnings (status quo).** Rejected — a warning is not a backstop, and this
  is the flagship ORM. The review's point stands.
- **Session-level GUC on a per-tenant connection (not `SET LOCAL`).** Rejected — session state on a
  pooled connection leaks across tenants; `SET LOCAL` inside a transaction is the only pool-safe form.
- **Tell Prisma users to use schema-per-tenant or database-per-tenant instead.** A valid steer (and we
  still make it), but it does not fix shared-database Prisma row-level, which is what most Prisma apps
  actually run.

## Consequences

- Prisma row-level gains a real database backstop and stops being second-class; the "proven with
  adversarial tests" story now holds for the most popular ORM.
- Cost: scoped work must run inside a transaction, which is a behavior change — long-lived scopes hold a
  connection for their duration, and Prisma's nested-interactive-transaction limits apply. The path
  requires a driver adapter (`@prisma/adapter-pg`); engine-protocol setups without it keep the
  facade-only path.
- Enables ADR-0038 (query freedom) for Prisma once shipped.
- Risk: this changes how Prisma reaches the database, so it landed behind real-database adversarial
  tests.

**Implemented 2026-07-07, verified against real PostgreSQL.** New `createPrismaRowLevelTenancy({ manager,
client, tables })` (additive - the facade `createPrismaAdapter` is unchanged). `run(cb)` opens a Prisma
interactive transaction, `SET LOCAL`s the tenant GUC, and hands the tenant-scoped `tx` to the callback -
full Prisma freedom (model queries, nested relations, raw SQL) all bound by the validated policy. A light
extension injects the tenant discriminator on writes (so the policy's `WITH CHECK` accepts them) and
passes reads/nested/raw through, since RLS is the enforcement. `validate()` reuses
`validatePostgresRlsPolicies` from `adapter-shared` (a Prisma executor bridges `?`→`$n` and the row
shape). Adversarial tests prove: model reads and raw SQL are RLS-scoped to the tenant; a create that
spoofs another tenant's id is forced back to the current tenant; and a **raw** cross-tenant insert (which
bypasses the facade) is rejected by the RLS `WITH CHECK` - the database is the last line of defense. Needs
a driver adapter (`@prisma/adapter-pg`); interactive transactions pin one connection, so no separate
driver requirement beyond that. 68 Prisma tests pass.

## Related Documents

- Architecture: docs/10-architecture/ARCHITECTURE.md
- Security: docs/20-security/SECURITY_MODEL.md, docs/20-security/ADAPTER_SECURITY_CONTRACT.md
- Related ADRs: ADR-0007 (Prisma row-level isolation contract), ADR-0010 (Postgres RLS-backed
  Knex/Lucid), ADR-0030 (Prisma schema-per-tenant driver routing), ADR-0033 (enforcement tiers),
  ADR-0038 (generalize the escape hatch to database-enforced tiers)
