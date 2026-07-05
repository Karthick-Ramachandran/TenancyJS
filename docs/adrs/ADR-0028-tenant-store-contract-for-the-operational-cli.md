# ADR-0028: Tenant Store Contract For The Operational CLI

## Status

Accepted

## Context

The operational CLI's registry commands (`list`/`create`/`suspend`/`activate`/`show`) need a source of
truth for tenants. TenancyJS deliberately does not own where tenants live (it propagates identity only),
and the owner chose **bring-your-own-store** over an owned registry. So the CLI must read/write tenants
through a host-provided contract. A prior review also flagged that a buggy resolver/store can return the
wrong tenant, and the toolkit currently cannot catch it.

## Decision

1. **A `TenantStore<TTenant>` interface, host-provided.** Methods, all optional so a store can implement
   only what it supports; a command errors clearly if its method is absent:
   `list()`, `find(id)`, `create(input)`, `suspend(id)`, `activate(id)`, `delete(id)`. Returned tenants
   carry `id` plus host fields (slug, domains, status, placement).
2. **Wired through `defineTenancyRuntime({ store })`** (ADR-0027); the CLI never assumes a schema or table
   — the host's store owns persistence (Prisma model, a Knex table, an API, anything).
3. **Hardened contract (closes the earlier "buggy resolver" gap).** TenancyJS validates the store's
   output: `find(id)` must return a tenant whose `id === id` (or the CLI/adapter throws instead of
   trusting a mismatched tenant); `list()` must return unique ids; `create` echoes the persisted id.
   `doctor` gains a check that a configured store round-trips `create`→`find` consistently. This makes
   bring-your-own safe: the toolkit catches a store that would otherwise hand back the wrong tenant.
4. **Placement is part of the record, not a separate resolver.** For schema/database-per-tenant, the
   store's tenant record carries the placement (schema name / connection ref) so `provision`/`migrate`
   route correctly — one source of truth.

## Alternatives Considered

- **TenancyJS owns a central `tenants` table (owned registry).** Rejected earlier by the owner: opinions
  the host's schema and adds migrations TenancyJS must manage. Bring-your-own stays unopinionated.
- **Raw resolver `find()` only, no validation.** Rejected: that is exactly the gap the review found —
  a mismatched return is faithfully (and dangerously) trusted.
- **A required base ORM model shipped by TenancyJS.** Rejected: couples the registry to one ORM; the
  store interface is ORM-neutral.

## Consequences

- Improves: registry commands work against any host store; the hardened contract catches wrong-tenant
  bugs at the boundary instead of leaking; placement-on-record keeps provisioning/migration routing
  single-sourced.
- Worsens/risks: the host implements the store (a small amount of code, or a provided helper); partial
  stores must degrade with clear "not supported by your store" errors, not crashes.

## Related Documents

- PRD: docs/40-features/F-012-cli-operational/PRD.md
- Architecture: docs/10-architecture/ARCHITECTURE.md
- Security: docs/20-security/SECURITY_MODEL.md
- Feature: docs/40-features/F-012-cli-operational
