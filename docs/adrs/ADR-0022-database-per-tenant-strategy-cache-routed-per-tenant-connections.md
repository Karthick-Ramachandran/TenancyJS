# ADR-0022: Database Per Tenant Strategy: Cache Routed Per Tenant Connections

## Status

Accepted

## Context

Row-level and schema-per-tenant are built (Knex/Lucid). The last missing isolation model is
**database-per-tenant**: each tenant's data lives in its own database. This is the strongest,
**database-enforced** isolation (separate databases — no shared rows, no shared schema, no cross-tenant
reachability), and the reason many teams need a tenancy toolkit. The bounded resource cache
(`createTenantResourceCache`, ADR-0021) already exists as the lifecycle primitive; this ADR decides how a
tenant scope routes to its own connection, avoiding the mistakes made earlier this session.

## Decision

1. **Cache-routed connections (shared orchestration, thin per-ORM binding).** The per-tenant connection
   lifecycle lives in `tenancyjs-adapter-shared` (the existing cache): `lease(tenantId, placementKey,
   create, callback)`. Each adapter provides only `create` (build its own client/connection from the
   resolved config) and the query binding. No per-adapter reimplementation of routing/lifecycle.
2. **Placement resolver (config now; `TenantStore` later).** Config gains, for `databasePerTenant`, a
   `connection(tenant) => { key, config }`: `key` is an **opaque** cache key
   (`^[A-Za-z0-9._:-]+$`, no URL/credentials), `config` is the ORM-specific connection config. When the
   hardened `TenantStore` lands, it supplies the placement instead of a config resolver.
3. **Central vs tenant.** Central-mode work uses the base/landlord connection the adapter was constructed
   with; tenant-mode work leases the tenant's connection from the cache. No `set_config`/`tenant_id` and
   no RLS are needed for isolation — separate databases are the isolation.
4. **Fail closed.** If the resolver throws, returns an invalid key, or the connection cannot be created,
   the scope errors (sanitized) — there is **no fallback to the central/shared database**. The cache
   surfaces a sanitized `TENANCY_RESOURCE_CACHE_CREATION` error; keys are validated opaque so credentials
   never appear in errors/logs.
5. **Validation.** `databasePerTenant` requires a `connection` resolver and a positive `maxConnections`;
   the adapter validates the base connection's runtime role is not superuser/BYPASSRLS (defense in depth).
   Per-tenant databases are validated at first lease (reachable), fail-closed.
6. **Capability honesty (the key discipline).** `databasePerTenant` flips to `"supported"` for an adapter
   **only after** a two-tenant adversarial test on **real, separate databases** proves tenant A's scope
   never reads/writes tenant B's database and vice versa. Until then it stays `"unsupported"` and the
   adapter refuses the strategy.
7. **Order.** Knex first (reuses the seam just built for schema-per-tenant), then Lucid, then Prisma
   (client-per-URL — clean). Each independently tested and gate-green with real databases.

## Alternatives Considered

- **Per-adapter connection routing.** Rejected — repeats the duplication mistake; the cache/placement
  orchestration is ORM-agnostic and belongs in `adapter-shared`.
- **One connection with per-tenant `SET`/search_path.** That is schema-per-tenant, not
  database-per-tenant; does not give separate-database isolation.
- **Unbounded per-tenant connections.** Rejected — resource exhaustion; the bounded LRU cache caps it.

## Consequences

- Improves: completes the three-model isolation set with the strongest (DB-enforced) guarantee; reuses the
  cache; no routing duplication.
- Worsens/risks: connection lifecycle/pool pressure (bounded by the cache, but capacity tuning matters);
  per-tenant DB credentials are a sensitive surface (mitigated by opaque keys + sanitized errors + the
  future `TenantStore`); provisioning (`CREATE DATABASE` + migrate) is a separate follow-up before it is
  usable end-to-end.

## Related Documents

- PRD: docs/40-features/F-009-isolation-strategies/PRD.md
- Architecture: docs/10-architecture/ARCHITECTURE.md
- Security: docs/20-security/SECURITY_MODEL.md
- Feature: docs/40-features/F-009-isolation-strategies
