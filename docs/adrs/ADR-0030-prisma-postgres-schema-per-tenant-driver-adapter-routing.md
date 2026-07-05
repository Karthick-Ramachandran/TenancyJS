# ADR-0030: Prisma Postgres Schema Per Tenant Driver Adapter Routing

## Status

Accepted

## Context

ADR-0017 deferred Prisma schema-per-tenant until a per-schema client cache could route each tenant
without relying on transaction-local `search_path`. That caution was correct: Prisma model queries use
the generated model datasource mapping, and the real-database experiment recorded in LESSONS proved
that changing `search_path` on an interactive transaction did not route those queries.

Prisma 7's official PostgreSQL driver adapter now exposes a distinct, constructor-level `schema`
option. It qualifies the driver's query target without changing the generated data model and therefore
provides the missing per-client placement seam. The shared tenant resource cache already supplies the
required bounded, collision-checked client lifecycle.

## Decision

1. Add `createPrismaSchemaTenancy`, a callback-scoped router that leases one host-created Prisma client
   per tenant schema through `createTenantResourceCache`.
2. The host resolves an opaque placement key and creates a client using Prisma 7's PostgreSQL driver
   adapter schema option, for example `new PrismaPg({ connectionString }, { schema })`. TenancyJS does
   not accept or retain credentials and never derives a schema from an unvalidated tenant ID.
3. The router rejects missing/central context, placement collisions, invalid callbacks, creation
   failures, and use after close. A leased client is valid only inside the callback; retaining it is
   unsupported because eviction may disconnect it.
4. This is **adapter-routed schema isolation**, not PostgreSQL authorization by itself. A shared
   credential that can access sibling schemas remains more privileged than the protected router. Hard
   database enforcement requires per-tenant credentials/roles restricted to the selected schema.
5. `schemaPerTenant` becomes supported for Prisma/PostgreSQL only after a real two-schema adversarial
   test creates colliding primary keys and proves tenant A cannot read or mutate tenant B's row.
6. MySQL does not receive a schema strategy. Its schema and database namespaces are synonymous, so
   separate-database routing is represented only as `databasePerTenant`.

## Alternatives Considered

- Transaction-local `search_path`: rejected and already disproven by a real Prisma test; it does not
  reliably redirect generated model queries.
- Compile every tenant schema into Prisma's `schemas`/`@@schema` model mapping: rejected because tenant
  schemas are dynamic placements, while those mappings are fixed at generation time.
- Generate a distinct Prisma Client artifact per tenant: rejected as operationally unbounded and
  unnecessary now that the driver adapter has an explicit schema option.
- Reuse the database router name and ask users to infer the placement kind: rejected because schema
  and database isolation have different guarantees and capability reporting.

## Consequences

Prisma gains schema-per-tenant without duplicating cache logic or reviving the failed `search_path`
approach. The callback and bounded-cache constraints are identical to the proven database router. The
remaining risk is credential scope: driver routing prevents accidental cross-tenant access through the
router, but a leaked native client or over-privileged credential can still reach sibling schemas. Docs
and validation must preserve that distinction.

## Related Documents

- PRD: `docs/40-features/F-009-isolation-strategies/PRD.md`
- Architecture: `docs/10-architecture/ARCHITECTURE.md`
- Security: `docs/20-security/SECURITY_MODEL.md`
- Feature: `docs/40-features/F-009-isolation-strategies/`
