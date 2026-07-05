# PRD: Nest Typeorm Sequelize

## Purpose

Close three launch-critical ecosystem gaps without weakening TenancyJS's fail-closed contract: native
NestJS request lifecycle integration and protected TypeORM/Sequelize data access. Reuse core tenant
context, identifiers, PostgreSQL strategy enforcement, resource caching, errors, and conformance
patterns instead of creating framework-specific isolation logic.

## In Scope

- `tenancyjs-integration-nest` for NestJS 11 on Express and Fastify platforms.
- `tenancyjs-adapter-typeorm` for TypeORM 1 and PostgreSQL 17.
- `tenancyjs-adapter-sequelize` for stable Sequelize 6.37 and PostgreSQL 17.
- Row-level, schema-per-tenant, and database-per-tenant adapter modes where ADR-0024/0025 define them.
- Unit, lifecycle, real-database adversarial, package-consumer, docs, and changeset evidence.

## Non-Goals

- Sequelize 7 alpha, NestJS 10, TypeORM pre-1 APIs, MongoDB, Drizzle, non-Node runtimes.
- Raw ORM access, query builders, ORM schema sync/migrations, arbitrary relations/associations, or
  claiming MySQL isolation without a separate enforceable decision and evidence.
- Authentication, membership authorization, tenant provisioning, or hidden connection credentials.

## Users And Outcomes

- Nest teams can resolve once, authorize against the resolved tenant, and run controller/service work
  inside the canonical tenant and optional ORM transaction scope.
- Express or other Node framework teams can use Sequelize or TypeORM adapters independently.
- Operators can distinguish database-enforced PostgreSQL guarantees from unsupported surfaces.

## Security

All base ORM objects remain application-private. Unknown models/operations and missing context fail
before delegation. PostgreSQL row-level mode requires forced RLS and a non-bypass role; schema and
database strategies retain their accepted enforcement-tier labels. No runtime network, telemetry,
cloud, MCP, file-write, or credential management is added.
