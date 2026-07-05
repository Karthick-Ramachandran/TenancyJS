# PRD: Drizzle And MySQL Adapter Support

## Problem

TenancyJS has no Drizzle adapter, while its TypeORM and Sequelize adapters advertise only PostgreSQL
evidence. Users cannot determine whether the same protected facade is safe on MySQL, and the CLI does
not recognize or scaffold these ORMs.

## Outcome

Ship a protected Drizzle adapter for PostgreSQL and MySQL, prove the applicable MySQL TypeORM and
Sequelize paths, and update the CLI and documentation so every claim names its enforcement tier and
real-database evidence.

## Scope

- Drizzle `0.45.x` on Node 24 using `node-postgres` and `mysql2`.
- PostgreSQL row-level, schema-per-tenant, and database-per-tenant Drizzle strategies.
- MySQL adapter-enforced row-level and database-per-tenant Drizzle strategies.
- MySQL adapter-enforced row-level and database-per-tenant TypeORM 1 and Sequelize 6 strategies.
- CLI detection and safe row-level boilerplate for Express projects using Prisma, TypeORM, Sequelize,
  or Drizzle; existing Adonis/Lucid and Next/Prisma paths remain intact.
- Capability matrix, package guides, website, security, architecture, module, and completion memory.

## Non-goals

- Drizzle for MongoDB; Drizzle is a SQL ORM and Mongoose owns MongoDB support.
- MySQL schema-per-tenant; MySQL schema and database namespaces are synonymous, so this is
  database-per-tenant.
- Raw SQL, native Drizzle database/session/query objects, relational query API, joins, subqueries,
  caller transactions, migrations, or schema generation inside a protected callback.
- Claiming MySQL row-level as database-enforced. MySQL has no PostgreSQL-equivalent RLS backstop.
- Drizzle 1.0 prerelease support.

## Security Requirements

- Unknown tables and unregistered handles fail closed.
- Protected CRUD accepts only plain scalar equality filters and plain values.
- Tenant predicates are always composed; creates inject or validate the discriminator; updates cannot
  move rows.
- PostgreSQL row mode validates forced RLS and applies transaction-local tenant context.
- PostgreSQL schema mode reuses the shared strategy engine and collision guards.
- Database mode reuses the bounded shared tenant resource cache with opaque placement keys.
- MySQL row mode is explicitly adapter-enforced and exposes no native escape surface.
- Every claimed database/strategy pair has a real two-tenant colliding-ID adversarial test.

## Source Of Truth

- ADR-0031: Drizzle protected SQL adapter boundary.
- ADR-0032: MySQL enforcement and support claims.
- `docs/20-security/ADAPTER_SECURITY_CONTRACT.md`
- `docs/50-quality/ADAPTER_OPERATION_MATRIX.md`

