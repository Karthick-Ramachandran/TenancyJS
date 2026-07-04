# ADR-0021: Database Per Tenant Resource Cache Lifecycle

## Status

Accepted

## Context

ADR-0017 requires database-per-tenant through per-tenant ORM clients/connections. Creating a pool per
request is too expensive, while an unbounded global map leaks connections and lets hostile tenant
cardinality exhaust the process. A cache-key collision can also route two tenant identities to one
database. Knex, Lucid, and Prisma need one lifecycle contract before any adapter advertises support.

## Decision

1. `@tenancyjs/adapter-shared` owns a generic, ORM-neutral `TenantResourceCache`. ORM adapters supply
   resource creation/destruction and retain their native public clients.
2. Every acquisition binds both the immutable tenant identity and an opaque, non-secret placement key.
   One tenant may have only one active placement and one placement key may belong to only one tenant;
   collisions fail before resource creation or callback execution.
3. Creation is single-flight per tenant/placement. Failed creation is not cached. Leases are reference-
   counted and always released in `finally` around the adapter callback.
4. Capacity is explicit and positive. When full, the cache evicts the least-recently-used idle entry and
   awaits destruction before admitting a new placement. If every entry is leased, acquisition fails
   closed instead of exceeding the bound.
5. `close()` blocks new acquisitions, waits for in-flight creation to settle, rejects while resources
   remain leased, then destroys every idle resource. Destruction continues across failures and returns
   a sanitized aggregate error without keys, tenant IDs, URLs, or credentials.
6. Placement objects contain a cache key and expected database identity, never credentials. A host-
   supplied factory closes over credentials/configuration. Each database adapter must verify the
   connected database identity before its first protected callback and cache only a validated client.
7. Capabilities stay `unsupported` until each adapter has real two-database isolation, collision,
   concurrency, eviction, failure, and shutdown evidence. This ADR and its cache task do not flip an
   adapter capability.

## Alternatives Considered

- New pool per callback: rejected for connection churn and database exhaustion.
- Unbounded map: rejected because tenant cardinality becomes unbounded resource growth.
- Time-based background eviction first: deferred because timers complicate deterministic shutdown;
  bounded LRU provides the required safety baseline.
- Cache by URL: rejected because URLs contain secrets and can leak through diagnostics/keys.
- Let every adapter implement a cache: rejected because collision, lease, eviction, and shutdown
  invariants are not ORM-specific and would drift.
- Evict leased entries or temporarily exceed capacity: rejected because either breaks active work or
  weakens the declared resource bound.

## Consequences

All database-per-tenant adapters share one bounded, deterministic lifecycle and one collision rule.
Resource creation is amortized without allowing active resources to be destroyed or cache cardinality
to grow silently. Tests can use fake resources without an ORM.

At saturation, a new tenant may receive an explicit capacity error while all cached tenants are busy;
operators must size the bound for expected concurrency. Adapters gain an explicit shutdown obligation.
Provisioning, credential storage, URL construction, retries, and cross-process cache coordination remain
outside this package and require later tasks.

## Related Documents

- PRD: `docs/40-features/F-009-isolation-strategies/PRD.md`
- Architecture: `docs/40-features/F-009-isolation-strategies/ARCHITECTURE_IMPACT.md`
- Security: `docs/20-security/SECURITY_MODEL.md`
- Feature: `docs/40-features/F-009-isolation-strategies/`
- Related decision: ADR-0017
