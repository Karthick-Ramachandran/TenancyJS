# ADR-0033: Enforcement Tier Aware Query Freedom: Full Query Access Where The Database Enforces Isolation

## Status

Accepted

## Context

Today the protected facade applies the same restrictions in every mode: raw queries, nested reads,
nested writes, joins, and complex criteria are rejected across all adapters (Lucid excepted for nested
reads). This keeps the fail-closed guarantee, but it adds real adoption friction — a developer on
PostgreSQL can't write a normal join or `include`, even though the database would isolate it anyway.

The restriction is **redundant wherever isolation is enforced below the query layer.** The facade's job
is to scope queries it controls; but in several modes the *database or connection* already guarantees
isolation for **every** query — including raw SQL and arbitrary nesting:

- **Database-per-tenant** — the connection *is* the tenant's database. Nothing is shared; any query is
  isolated by construction.
- **Row-level with forced PostgreSQL RLS** — RLS applies to every table referenced in a statement
  (joins and nested reads included) and cannot be bypassed by query shape or raw SQL.
- **Schema-per-tenant with a per-tenant role** — the role has `USAGE` on only its own schema, so the
  database rejects cross-schema access even under a hand-qualified raw query.

In these modes the facade restrictions buy no safety — only friction. The friction is genuinely
unavoidable only where the facade is the *sole* enforcement layer.

Successful prior art (Laravel's `stancl/tenancy`) leans on database-per-tenant precisely because
connection isolation lets developers write completely normal queries. We can offer that ergonomics
*and* keep the stronger guarantee on PostgreSQL.

## Decision

Introduce an explicit **enforcement tier** per active scope and let it decide query freedom:

- **`database-enforced` tier → full query freedom.** `run()` yields the real, tenant-scoped ORM client
  (the leased connection / the transaction with `search_path`+role / the RLS-scoped transaction). The
  developer may use nested reads, nested writes, joins, and raw queries freely — the database boundary
  isolates every one. This tier is entered when, and only when:
  1. **database-per-tenant** (separate connection), or
  2. **row-level** with **forced RLS validated** on every tenant table (PostgreSQL), or
  3. **schema-per-tenant** with a **per-tenant role** configured (database-enforced).
- **`facade-enforced` tier → restricted (unchanged).** `run()` yields the current protected facade
  (scalar criteria only; raw/native/nested rejected). This tier applies to:
  - **row-level on MySQL** (no RLS backstop),
  - **Mongoose** (no RLS backstop),
  - **schema-per-tenant without a per-tenant role** (a bare `search_path` is a default, not a boundary —
    a raw query can qualify a sibling schema and escape).

**What counts as `database-enforced` (derived from real enforcement, never a flag):**

- **`search_path` alone is NOT a boundary** — it is a resolution default; a qualified/raw query escapes.
- **Prisma's schema-routing (driver-adapter `{ schema }` binding) alone is adapter isolation, NOT
  database authorization** — it selects a schema, it does not deny access to others. Prisma
  schema-per-tenant is therefore `facade-enforced` unless paired with a restricted per-tenant role.
- **Forced PostgreSQL RLS counts only if the active connection role cannot bypass it** — i.e.
  `FORCE ROW LEVEL SECURITY` on every tenant table AND a role that is neither the table owner-with-bypass
  nor `BYPASSRLS`. RLS a bypassing role can ignore is not a boundary.
- **Schema-per-tenant counts as `database-enforced` only with a restricted per-tenant role** (USAGE on
  its own schema only).
- **Every capability flip requires real two-tenant adversarial tests** on a live database for the exact
  freed query shape.

**Fail-closed-on-context is unchanged in every tier**: no valid tenant context still throws. Central
scope, cross-placement rejection, and disposal are unchanged. The relaxation is *only* about which
query shapes are allowed once a valid, database-enforced scope is established — never about running
unscoped.

Roll out by operation, **reads before writes**, each behind its own two-tenant adversarial test
(colliding ids, fails if either tenant observes the other):

- **Phase 1 — nested reads (+ joins, raw reads)** in database-enforced tiers: database-per-tenant
  (immediate — isolation by construction), then PostgreSQL row-level+forced-RLS+non-bypass-role and
  schema-per-tenant+restricted-role (each after its adversarial test).
- **Phase 2 — nested writes**: database-per-tenant (easiest), schema-per-tenant+role, then PostgreSQL
  RLS **only after `WITH CHECK` policy tests** prove cross-tenant writes are rejected.
- **Facade-only tiers** (MySQL row-level, Mongoose, role-less schema-per-tenant, shared-table) reject in
  every phase.

A capability's `nestedReads`/`nestedWrites`/`rawQueries` may only flip to `supported` for a tier after
that tier's adversarial test passes on a real database.

**One-line policy:** *nested/raw queries are allowed when the whole query graph is isolated by the
database or connection; otherwise TenancyJS rejects them fail-closed.*

## Alternatives Considered

- **Keep restrict-everywhere.** Rejected: redundant friction on the database-enforced majority; it is
  the top adoption objection and offers no safety benefit where the DB already isolates.
- **Relax the facade globally (allow nested/raw everywhere).** Rejected outright: on MySQL/Mongo and
  bare schema-per-tenant there is no backstop — this would be a real cross-tenant leak.
- **A user-set "trust me" flag.** Rejected: safety must be derived from the *actual* enforcement in
  effect (validated RLS / role / separate connection), never from an opt-in claim.

## Consequences

- Improves: PostgreSQL and database-per-tenant users — the serious majority — write normal queries
  (joins, nested reads, raw) with zero friction and full isolation; matches the ergonomics that made
  connection-per-tenant tooling popular, without giving up the guarantee.
- Worsens/risks: the adapters gain tier-detection logic and a second client-exposure path, which must be
  exactly right — handing over the real client in a scope that is *not* actually database-enforced would
  leak. Every tier flip is therefore gated on an adversarial test, and each adapter change is
  independently reviewed. MySQL/Mongo and role-less schema-per-tenant stay restricted and clearly
  labeled.

## Related Documents

- PRD: docs/40-features/F-014-f-014-tier-aware-query-freedom/PRD.md
- Architecture: docs/10-architecture/ARCHITECTURE.md
- Security: docs/20-security/SECURITY_MODEL.md
- Feature: docs/40-features/F-014-f-014-tier-aware-query-freedom
