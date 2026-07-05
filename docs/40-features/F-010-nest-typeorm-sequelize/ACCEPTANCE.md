# Acceptance Criteria: Nest Typeorm Sequelize

## Criteria

- AC-01: NestJS 11 module resolves each marked request once; only `resolved` enters tenant execution.
- AC-02: Nest authorization guards can read the frozen resolved tenant without opening imperative ALS;
  controller/service Observable work runs inside context until complete, error, or unsubscribe.
- AC-03: Nest Express and Fastify tests prove concurrency, cleanup, sanitized errors, and no central
  fallback; a real adapter-backed E2E proves two-tenant isolation.
- AC-04: TypeORM 1 and Sequelize 6 reject missing context, unknown entities/models, raw/client escape,
  unsupported relations, tenant-field conflicts, and tenant-changing updates.
- AC-05: Supported CRUD/count operations preserve caller filters and isolate two tenants under forced
  PostgreSQL RLS with commit, rollback, concurrency, and pooled reuse evidence.
- AC-06: Schema mode rejects qualified access and placement collisions; database mode rejects opaque-key
  collisions and proves colliding row IDs cannot cross separate databases.
- AC-07: Capability matrices, README security boundaries, changesets, packed consumers, and Persist
  memory match the implemented surface; `pnpm check` and dependency audit pass.

## Out Of Scope

- MongoDB/Mongoose (F-011), Drizzle, Sequelize 7 alpha, unsupported SQL providers, raw queries,
  relation traversal, migrations/sync, provisioning, and authentication/authorization policy.
