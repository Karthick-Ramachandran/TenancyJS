# ADR-0038: Generalize The Unrestricted Escape Hatch To Database Enforced Tiers

## Status

Accepted

## Context

ADR-0033 established that full query freedom — raw SQL, joins, nested reads/writes, and `unrestricted()`
— is safe only where the database itself enforces isolation, and that the signal must be a runtime
`databaseEnforced` flag set from the actual call site, never derived from the strategy name. Correct.
But today that flag is set `true` on exactly one path: a database-per-tenant lease in tenant mode. Every
adapter's `unrestricted()` throws `unrestrictedRefusedMessage(...)` unless `databaseEnforced` is true,
and the facade rejects raw SQL uniformly via a `Proxy` surface that is unaware of RLS.

The consequence is over-conservative. Postgres **row-level under forced RLS** is genuinely
database-enforced: the tenant GUC is `SET LOCAL` at the top of the same transaction the scoped work runs
in (re-applied per savepoint), the runtime role is non-owner / non-superuser / non-`BYPASSRLS`, and
`validatePostgresRlsPolicies` has confirmed the policy contract at startup. A raw query issued in that
scope *would* be filtered by the policy and could not reach another tenant. Yet `unrestricted()` and raw
SQL are refused there anyway, because forced-RLS row-level never flips `databaseEnforced`. This is the
single largest DX complaint (raw SQL / joins / nested blocked) and it hits the majority of stacks — the
forced-RLS Postgres adapters: Knex, TypeORM, Sequelize, Drizzle, Lucid — even though those scopes are
provably safe.

## Decision

Make `databaseEnforced` a function of the **proven enforcement tier**, not the strategy. A scope is
database-enforced when **either**:

- (a) it leased the tenant's own database (today's behavior), **or**
- (b) it runs under forced PostgreSQL RLS where **all** of these hold: startup validation
  (`validatePostgresRlsPolicies`) passed; the runtime role is non-owner, non-superuser, and
  non-`BYPASSRLS`; and the tenant GUC is `SET LOCAL` in the same transaction as the scoped work.

Under (b), lift `databaseEnforced → true` so `unrestricted()` returns the scoped transaction handle and
`databaseEnforcedCapabilities()` lifts raw/nested to `supported`. The preconditions are hard and
fail-closed: if validation did not pass, or the role can bypass RLS, or the GUC is not transaction-local,
`databaseEnforced` stays false and the scope stays facade-enforced. This is never derived from the
strategy string. Facade-only placements (MySQL row-level, MongoDB, and Prisma row-level until ADR-0037
ships) remain facade-enforced and keep refusing.

**Semantics, documented per tier.** `unrestricted()` means different things in the two database-enforced
tiers, and the distinction is load-bearing:

- Database-per-tenant: the returned handle is the tenant's own database — raw SQL can touch anything in
  it, and there is physically no other tenant to reach.
- Forced-RLS row-level: the returned handle is the scoped transaction — raw SQL runs, but the RLS policy
  still binds it to the current tenant. It is full query *freedom*, not a cross-tenant *escape*. A raw
  statement cannot widen its own scope because the runtime role cannot `BYPASSRLS` or `SET ROLE` to one
  that can, and the GUC that the policy reads is the tenant's.

**Implementation note (found 2026-07-07, before any code shipped).** This is NOT a one-line flag flip.
Today `unrestricted()` returns the adapter's *base* client (e.g. the base `Sequelize` instance), which is
correct for database-per-tenant (that base is the leased per-tenant connection) but wrong for row-level:
the tenant GUC is `SET LOCAL` inside the scoped transaction, so raw SQL issued on the base client's *other*
pooled connections has no GUC and RLS blocks every row — fail-closed but useless, not the intended escape
hatch. To honour the "returned handle is the scoped transaction" semantics above, each adapter's
`unrestricted()` must, for the forced-RLS row-level tier, return a **transaction-bound** handle (the active
`transaction`, or a raw-query function pre-bound to it), not the base client. That is a per-adapter API
change (Knex/Sequelize/TypeORM/Drizzle/Lucid) and must land behind the adversarial suite below. Flipping
only the `databaseEnforced` boolean without the tx-bound handle would ship a broken (though not leaking)
escape hatch, so the boolean and the handle change must land together.

**Decided API shape (2026-07-07): native transaction-bound handle.** On inspection, 4 of the 5 SQL
adapters already return a transaction-scoped native handle from `unrestricted()` — Knex (`Knex.Transaction`),
Lucid (`TransactionClientContract`), TypeORM (the scoped `EntityManager`), and Drizzle (`session.native`,
the tx) — so for those the change is the `databaseEnforced` flag plus a test that the handle is tx-bound in
row-level mode. Only **Sequelize** returns the base `Sequelize` instance; its `unrestricted()` changes to
return `{ sequelize, transaction }` (both tiers), so raw SQL runs as `sequelize.query(sql, { transaction })`
on the GUC-bound transaction. This is a **breaking change** to `tenancyjs-adapter-sequelize`'s
`unrestricted()` return type (acceptable pre-1.0, minor bump). Rejected the uniform `{ native, sql() }`
wrapper (churns the 4 already-correct adapters, less idiomatic) and the additive `rawScoped()` method
(leaves `unrestricted()` misleadingly unavailable on a database-enforced tier).

## Alternatives Considered

- **Keep strategy-gated (status quo).** Rejected — it refuses provably-safe operations and is the top
  friction point for most users.
- **Allow raw SQL everywhere with a warning.** Rejected — unsafe on facade-only placements, which have no
  backstop; this is precisely where fail-closed must hold.
- **A separate `rawUnderRls()` API distinct from `unrestricted()`.** Rejected — more surface for the same
  capability; generalizing the existing flag is cleaner. The per-tier semantics are documented instead.

## Consequences

- Dissolves most of the facade DX friction for forced-RLS Postgres stacks with **zero loss of
  guarantee** — the database still fails closed. Reporting, analytics, and complex queries become
  possible on the common row-level stacks without dropping to database-per-tenant.
- Requires per-adapter changes to thread the "RLS validated + restricted role + tx-local GUC" signal
  into `databaseEnforced`, and flips existing expectations: tests like Knex's "refuses `unrestricted()`
  in row-level scope" become "allows it under validated forced RLS, still refuses without it," plus new
  adversarial tests (raw SQL under RLS cannot cross tenants; `unrestricted()` is refused when validation
  fails or the role can bypass RLS).
- Risk: a wrong precondition here is a cross-tenant leak. The gate must be the *validated* RLS signal,
  not a hopeful one — so the flag is only lifted for `rowLevel` + tenant mode + (for the adapters that
  also support MySQL row-level) `dialect === "postgresql"`, and every adapter gates `run()` on
  `validate()`, so reaching a row-level Postgres scope means the forced-RLS contract passed.

**Implemented 2026-07-07, verified against real PostgreSQL.** All five SQL adapters ship it: Knex, Lucid
(Postgres-only row-level → `rowLevel && tenant`), and TypeORM, Sequelize, Drizzle (also MySQL row-level →
`rowLevel && postgresql && tenant`). Sequelize's `unrestricted()` now returns `{ sequelize, transaction }`
(breaking, minor bump); the other four already returned a tx-bound native handle, so they were the flag
plus a test flip. Each adapter has an adversarial Postgres test proving raw SQL via `unrestricted()`
returns only the current tenant's row (two tenants, colliding primary key) and that `unrestricted()` is
still refused in central mode. The capability matrix metadata still reports `rawQueries: "rejected"` for
row-level (conservative, and accurate for MySQL row-level); the runtime hatch is the deliverable.

## Related Documents

- Architecture: docs/10-architecture/ARCHITECTURE.md
- Security: docs/20-security/SECURITY_MODEL.md, docs/20-security/ADAPTER_SECURITY_CONTRACT.md
- Related ADRs: ADR-0033 (enforcement-tier-aware query freedom — the `unrestricted()` model), ADR-0010
  (Postgres RLS-backed Knex/Lucid), ADR-0019 (adapter-shared Postgres strategy engine), ADR-0037
  (RLS-backed Prisma, which this then covers)
