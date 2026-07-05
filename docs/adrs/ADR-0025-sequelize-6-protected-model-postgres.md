# ADR-0025: Sequelize 6 Protected Model PostgreSQL Boundary

## Status

Accepted

## Context

Sequelize support is a launch requirement, including Express applications. As of this decision the
stable package is Sequelize 6.37; `@sequelize/core` 7 remains alpha. Sequelize hooks do not cover raw
queries or QueryInterface, and its native model/instance APIs expose associations, scopes, literals,
and transactions that can bypass a simple tenant hook.

## Decision

1. Publish `@tenancyjs/adapter-sequelize` for stable Sequelize `>=6.37 <7`, PostgreSQL 17, and Node 24.
2. Expose exhaustive model classification and callback-scoped protected model facades. Every operation
   receives the adapter-owned managed transaction explicitly; the adapter does not depend on global CLS.
3. Row-level mode injects/composes the discriminator and validates forced PostgreSQL RLS through shared
   primitives. Schema mode reuses the shared search-path/role engine. Database mode uses the shared
   bounded tenant-resource cache with host-created Sequelize resources and opaque keys.
4. The initial facade supports reviewed find/count/create/bulk-create/update/destroy operations with
   plain object filters and values. It rejects or omits raw queries, literals, includes/associations,
   scopes, instance mutation/save, QueryInterface, sync/migrations, caller transactions, and unknown
   models/operations.
5. Returned rows are plain values rather than live Sequelize instances with escape methods.
6. Sequelize 7 support is deferred until a stable release and its own compatibility lane.

## Alternatives Considered

- Target Sequelize 7 alpha: rejected for a launch-quality compatibility promise.
- Global model hooks only: rejected because documented raw and QueryInterface paths skip them.
- Expose native transaction/models: rejected because raw, literals, associations, and unclassified
  models would remain reachable.

## Consequences

Express and other framework users gain a stable Sequelize slice backed by the existing PostgreSQL
security engine. The facade is narrower than native Sequelize, and v7 will require a future adapter
compatibility decision rather than being implied.

## Related Documents

- PRD: `docs/40-features/F-010-nest-typeorm-sequelize/PRD.md`
- Architecture: `docs/10-architecture/ARCHITECTURE.md`
- Security: `docs/20-security/SECURITY_MODEL.md`
- Feature: `docs/40-features/F-010-nest-typeorm-sequelize/`
