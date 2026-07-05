# ADR-0026: Mongoose 9 Protected Model MongoDB Isolation

## Status

Accepted

## Context

MongoDB/Mongoose were deferred from the initial platform but are now an explicit launch requirement.
MongoDB has no PostgreSQL-style row policy that TenancyJS can validate, and Mongoose middleware does
not cover every raw collection/driver path. A normal Mongoose document also carries model methods that
can escape a protected query wrapper.

## Decision

1. Publish `@tenancyjs/adapter-mongoose` for Mongoose `>=9.7 <10`, MongoDB 8 replica sets, and Node 24.
2. Row-level isolation is explicitly **adapter-enforced**. A callback-scoped protected model facade
   injects/composes the tenant discriminator for reviewed CRUD/count operations, validates create and
   update conflicts, passes one adapter-owned session to every operation, and returns lean plain data.
3. Every model is classified tenant or central. Native models, documents, Query, Aggregate,
   Collection, connection/client, populate, bulkWrite, mapReduce, watch/change streams, and raw driver
   access stay private or unsupported. Unknown operations fail closed.
4. Row-level `run` uses `Connection.transaction()` so session cleanup/rollback is deterministic and is
   tested on a real replica set. The transaction does not upgrade the isolation tier: correctness still
   depends on the protected facade and exhaustive classification.
5. `databasePerTenant` reuses the shared bounded cache with host-created, per-tenant Mongoose resources
   and opaque placement keys. It is database-enforced only when host credentials restrict each resource
   to its intended database; otherwise it is a routing boundary, not an authorization boundary.
6. `schemaPerTenant` is rejected because MongoDB has no SQL schema/search-path equivalent.
7. Stable support requires two-tenant adversarial tests with colliding `_id` values, conflict and escape
   tests, transaction cleanup, database-router collision evidence, and package-consumer checks.

## Alternatives Considered

- Schema plugin/global middleware only: rejected because raw collections, drivers, and some operations
  bypass middleware, while live returned documents retain escape methods.
- Expose native Mongoose models inside a tenant context: rejected because the model surface is too broad
  to make unknown operations fail closed.
- Call Mongo database-per-tenant always database-enforced: rejected because a shared credential may
  still read sibling databases.

## Consequences

Mongo users receive a narrow, honest isolation contract and reuse the shared cache. Row-level Mongo is
weaker than PostgreSQL forced RLS and must never share its guarantee label. Transactions require a
replica set and add cost; native document ergonomics, populate, aggregation, and change streams are
deferred until they can be intercepted and adversarially tested.

## Related Documents

- PRD: `docs/40-features/F-011-mongoose-mongodb/PRD.md`
- Architecture: `docs/10-architecture/ARCHITECTURE.md`
- Security: `docs/20-security/SECURITY_MODEL.md`
- Feature: `docs/40-features/F-011-mongoose-mongodb/`
