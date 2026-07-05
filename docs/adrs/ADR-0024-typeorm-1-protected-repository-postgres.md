# ADR-0024: TypeORM 1 Protected Repository PostgreSQL Boundary

## Status

Accepted

## Context

TypeORM is a launch requirement and its native `DataSource`, `EntityManager`, repositories, query
builders, and Active Record entities expose raw and cross-entity escape paths. Subscribers improve
ergonomics but cannot prove isolation for every API. The adapter must reuse the shared PostgreSQL
engine without exposing a native object that bypasses it.

## Decision

1. Publish `@tenancyjs/adapter-typeorm`, initially targeting TypeORM `>=1 <2`, PostgreSQL 17, and Node 24.
2. Expose `createTypeOrmTenancy` with exhaustive tenant/central entity classification and a
   callback-scoped `run(protected => ...)` API. The base `DataSource`, transaction manager,
   `QueryRunner`, repository, query builder, and `.query()` never cross the boundary.
3. Protected repositories expose only reviewed CRUD/count methods. Row-level mode composes the tenant
   discriminator into object criteria, injects/validates creates, forbids tenant moves, and runs inside
   forced PostgreSQL RLS using the shared validation/context SQL.
4. Schema mode reuses `createPostgresStrategyEngine`, requires unqualified entity tables, and exposes no
   raw or cross-schema operation. Database mode reuses `createTenantResourceCache` with host-created
   per-tenant `DataSource` resources and an opaque placement key.
5. Relations, eager/lazy loading, QueryBuilder, raw SQL, migrations, schema sync, Active Record static
   methods, arbitrary criteria forms, and unknown methods fail or remain unavailable until separately
   proven. Returned entities are data values, not an authorized handle to a base manager.
6. Capabilities flip only after real PostgreSQL two-tenant adversarial tests for each strategy.

## Alternatives Considered

- Global subscribers only: rejected because direct query/raw and some entity paths remain outside a
  complete interception boundary.
- Pass the transactional `EntityManager`: rejected because it exposes `.query()`, arbitrary entities,
  and QueryBuilder.
- Promise all TypeORM databases: rejected; PostgreSQL forced RLS is the first database-enforced row
  boundary, and MySQL needs a separate application-enforced decision and evidence.

## Consequences

The adapter reuses one audited SQL/strategy/cache implementation and gives TypeORM users a defensible
subset. Native repository breadth is intentionally reduced; applications must keep every base ORM
surface private and use a migration role for schema work.

## Related Documents

- PRD: `docs/40-features/F-010-nest-typeorm-sequelize/PRD.md`
- Architecture: `docs/10-architecture/ARCHITECTURE.md`
- Security: `docs/20-security/SECURITY_MODEL.md`
- Feature: `docs/40-features/F-010-nest-typeorm-sequelize/`
