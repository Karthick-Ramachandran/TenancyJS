# PRODUCT: TenancyJS

## Purpose

TenancyJS is an open-source, TypeScript-first multi-tenancy toolkit for Node.js. It gives
applications one framework-neutral tenant model, fail-closed tenant context, data-layer isolation
adapters, framework integrations, shared testing contracts, and a CLI. Teams keep their framework
and ORM workflows while using consistent tenancy boundaries.

The product reduces the time and risk of implementing tenant resolution, context propagation, query
scoping, and tenant-aware operations. If a valid tenant context cannot be established, tenant-aware
data access must fail rather than silently run without isolation.

## Users

The primary users are SaaS engineering teams building Node.js applications with Express, Next.js,
NestJS, or AdonisJS and supported SQL or MongoDB data layers. Platform engineers responsible for
tenant isolation, database provisioning, and migrations are also users.

## Product

TenancyJS provides a common tenancy lifecycle across supported combinations of frameworks and data
layers. Integrations resolve and carry tenant context through application work. Adapters enforce
the selected isolation strategy through the host ORM or database APIs. The CLI scaffolds and runs
tenant-aware operations through the application's own tenant store and migration or provisioning
hooks.

The initial isolation strategies are row-level isolation, PostgreSQL schema-per-tenant, and
database-per-tenant. MySQL and MongoDB use database-per-tenant where schema-per-tenant does not
apply. Migration and schema operations remain delegated to the host tooling.

## Current state

TenancyJS is in beta implementation. Its supported framework surface includes Express, Next.js App
Router, NestJS, and AdonisJS. Its data-layer surface includes Prisma, Sequelize, TypeORM, Drizzle,
Knex, Lucid, and Mongoose. The project treats a combination as supported only when its vertical
slice is backed by CI, examples, and two-tenant isolation evidence; claims should follow the
repository's current test evidence.

The packages are distributed separately from a TypeScript monorepo. Node.js 24 or newer is the
common runtime baseline. The project does not guarantee tenant database access from Edge runtimes.

## Product principles

- Fail closed when tenant-aware data access has no valid tenant context.
- Never rely on process-global mutable tenant state.
- Keep the core independent of frameworks and ORMs.
- Prefer tested vertical slices over broad, unverified compatibility claims.
- Preserve native framework and ORM workflows, including their migration tooling.
- Make generated writes previewable, idempotent, conflict-aware, and safe with secrets.
- Provide an explicit incremental adoption path while targeting greenfield use first.

## Success criteria

- A user can run the first supported isolation test within 15 minutes of starting the quickstart.
- Each stable framework and adapter slice has CI, an example, and two-tenant end-to-end evidence.
- The project establishes one secure vertical slice before expanding compatibility breadth.
- Core isolation capabilities remain MIT-licensed and do not require a hosted service.

## Non-goals

The initial product does not provide billing or subscription interfaces, hosted control planes,
DNS or SSL automation, or administration dashboards. It does not promise isolation for arbitrary
raw SQL, cache or storage systems, impersonation, or resource syncing. It does not replace framework,
ORM, or migration tooling, and it does not guarantee support for combinations without repository
test evidence.
