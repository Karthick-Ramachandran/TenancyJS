# ADR-0018: Schema Per Tenant Enforcement: Search Path With Optional Per Tenant Role

## Status

Accepted

## Context

F-009/ADR-0017 commit TenancyJS to schema-per-tenant (one Postgres schema per tenant, same database),
built on Knex and Lucid first (Prisma deferred). The Knex/Lucid adapters already run every tenant scope
inside a transaction and set transaction-local session state (`set_config(..., is_local => true)`), and
the protected client already rejects raw queries. Schema-per-tenant reuses that seam. The open question
is what "fail closed" means for this strategy, because the isolation mechanism differs from row-level
forced RLS.

With a **single shared runtime role**, schema-per-tenant isolation is **adapter-enforced**: a
transaction-local `search_path` points at exactly the current tenant's schema, unqualified table names
resolve there, and the adapter refuses raw/cross-schema-qualified access. This is the same *class* of
enforcement as Prisma's query-scoping — not database-enforced. A shared role must hold `USAGE` on every
tenant schema, so the database itself would not stop a hand-written `tenant_other.table` query; only the
adapter's no-raw/unqualified rule does. To make it **database-enforced** (hermetic), each tenant needs a
Postgres role with `USAGE` on only its own schema.

## Decision

Ship **both**, adapter-enforced by default with an opt-in database-enforced mode.

1. **Runtime seam.** In the existing per-transaction context step, additionally set a transaction-local
   `search_path` to the tenant's schema (`set_config('search_path', <schema>, true)`), resolved from the
   tenant context via a configured `schema(tenant) => string` (a validated identifier). Central context
   uses the configured central/`public` schema.
2. **Query addressing.** In schema-per-tenant mode the protected client addresses tenant tables
   **unqualified** (search_path routes them) and does **not** add a `tenant_id` filter. Raw queries stay
   rejected. Cross-schema-qualified names are rejected.
3. **Adapter-enforced (default).** One shared runtime role with `USAGE` on tenant schemas; isolation is
   the transaction-local `search_path` + unqualified addressing + no-raw. Documented honestly as
   adapter-enforced, the same class as Prisma query-scoping — **not** DB-enforced.
4. **Database-enforced (opt-in).** A per-tenant role holding `USAGE`/privileges on only its own schema;
   the tenant scope connects/`SET ROLE`s as that role, so the database blocks cross-schema access. Heavier
   provisioning (role + grant lifecycle), ops closer to database-per-tenant.
5. **Capability honesty.** `schemaPerTenant` flips to `"supported"` for Knex/Lucid **only after** a
   two-tenant adversarial isolation test proves no cross-schema read/write through the protected client.
   The adapter refuses `schemaPerTenant` until then (fail closed).
6. **Provisioning.** `CREATE SCHEMA` + per-schema migration (and, in DB-enforced mode, per-tenant role +
   grants) via `tenancy provision`/`deprovision`.

## Alternatives Considered

- **Adapter-enforced only.** Simplest, but leaves a shared-role cross-schema query unblocked at the DB;
  some teams need DB-enforced. Kept as the default, not the only option.
- **DB-enforced only.** Strongest, but forces per-tenant-role ops on everyone; too heavy as the baseline.
- **`SET search_path` outside a transaction (session-level).** Rejected: not scoped/reverted; a leaked
  connection would retain a tenant's path. Transaction-local `set_config(..., true)` reverts on commit.

## Consequences

- Improves: schema-per-tenant works on Knex/Lucid reusing the proven transaction seam; teams pick the
  enforcement level they need; capability claims stay honest (adapter- vs database-enforced is stated).
- Worsens/risks: two code paths (shared vs per-tenant role); DB-enforced mode adds role/grant lifecycle;
  adapter-enforced isolation depends on the no-raw/unqualified rule holding — every escape (raw, qualified
  cross-schema) must be closed and adversarially tested. No capability flips to `supported` without that
  test.

## Related Documents

- PRD: docs/40-features/F-009-isolation-strategies/PRD.md
- Architecture: docs/10-architecture/ARCHITECTURE.md
- Security: docs/20-security/SECURITY_MODEL.md
- Feature: docs/40-features/F-009-isolation-strategies
