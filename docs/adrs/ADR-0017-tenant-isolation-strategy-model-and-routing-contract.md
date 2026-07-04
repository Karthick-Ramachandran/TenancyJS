# ADR-0017: Tenant Isolation Strategy Model And Routing Contract

## Status

Accepted

## Context

TenancyJS ships only **single-database, shared-schema, row-level** isolation (a `tenant_id` column with
forced Postgres RLS for Lucid/Knex, or query-scoping for Prisma). The owner has decided **not** to launch
on the easy case alone: the reason teams reach for a multi-tenancy toolkit is precisely the harder
patterns. So TenancyJS must also support **schema-per-tenant** (one Postgres schema per tenant, same
database) and **database-per-tenant** (one database per tenant), before launch.

Core already anticipated this: `TenancyStrategy` is a config field and each adapter publishes a
`TenancyAdapterCapabilities` matrix. But `schemaPerTenant` did not exist, and there is no contract for how
a tenant context resolves to a schema or a connection at runtime.

This ADR fixes the **model and the extension points**; per-strategy behavior lands in later, separately
tested increments.

## Decision

1. **Three strategies, one config field.** `TenancyStrategy = "rowLevel" | "schemaPerTenant" |
   "databasePerTenant"`. `defineConfig` accepts all three; unknown values still throw at the runtime
   boundary.
2. **Per-adapter capability matrix gains `schemaPerTenant`.** `TenancyAdapterCapabilities` adds
   `schemaPerTenant`. Every adapter declares its status; today all three declare `schemaPerTenant:
   "unsupported"` and `databasePerTenant: "unsupported"`. An adapter must never accept a strategy it does
   not declare `"supported"` — fail closed.
3. **Routing contract (to be implemented per strategy).** Beyond row-level, a tenant context resolves to a
   *placement*: a schema name (schema-per-tenant) or a connection reference/URL (database-per-tenant).
   That placement is supplied by the host's `TenantStore` (see the bring-your-own-store decision) — the
   store returns tenant **identity + placement**, and the adapter routes queries accordingly
   (`search_path` for schema-per-tenant; a per-tenant client/connection for database-per-tenant). The
   concrete `TenantPlacement` type is defined with its first real consumer, not speculatively here.
4. **Per-adapter approach.** Knex and Lucid support schema-per-tenant natively (`withSchema` /
   `search_path`; Lucid named connections). Database-per-tenant is a per-tenant client/connection cache
   for all three adapters (Prisma: a client per DB URL).
5. **Prisma schema-per-tenant is deferred.** Prisma has no native per-request schema switching (schema is
   fixed at generate time). Giving Prisma schema-per-tenant via a **per-schema client cache**
   (search_path connection options) is a deliberate, attractive differentiator but is **deferred**: Prisma
   supports `rowLevel` and `databasePerTenant` first; `schemaPerTenant` stays `"unsupported"` for Prisma
   until the cache lands. Knex/Lucid get schema-per-tenant first.
6. **Provisioning is part of the story.** `schemaPerTenant`/`databasePerTenant` require `CREATE
   SCHEMA`/`CREATE DATABASE` + per-placement migration (`tenancy provision`/`deprovision`), delivered with
   the strategies, not before.

## Alternatives Considered

- **Launch shared-schema only.** Rejected by the owner: the hard patterns are the point.
- **Put schema/DB routing on `TenantRecord`.** Rejected: pollutes identity; a separate placement resolved
  by the store keeps identity clean and fail-closed.
- **Force Prisma schema-per-tenant now via interactive-transaction `search_path`.** Rejected for the first
  pass: it constrains every query into one interactive transaction; the per-schema client cache is the
  better long-term shape and is deferred rather than rushed.

## Consequences

- Improves: the strategy set and capability matrix are honest and extensible; adapters fail closed on
  unsupported strategies; the launch scope now matches the product's real value.
- Worsens/risks: a large, multi-increment build (routing, provisioning, per-adapter connection/schema
  management, adversarial isolation tests per strategy x adapter). Prisma schema-per-tenant is a known
  hard spot, explicitly deferred. Connection/pool lifecycle for database-per-tenant needs care.
- This ADR is **foundation only**: strategy union + capability field + config validation, no behavior
  change. Each strategy is a later ADR-referenced increment.

## Related Documents

- PRD: docs/40-features/F-009-isolation-strategies/PRD.md
- Architecture: docs/10-architecture/ARCHITECTURE.md
- Security: docs/20-security/SECURITY_MODEL.md
- Feature: docs/40-features/F-009-isolation-strategies
