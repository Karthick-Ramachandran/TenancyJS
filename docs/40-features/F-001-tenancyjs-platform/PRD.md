# PRD: Tenancyjs Platform

## Purpose

Give Node.js teams a consistent, testable way to add multi-tenancy without rebuilding tenant
resolution, async context, ORM scoping, framework middleware, and operational scripts for each app.
The primary outcome is preventing accidental cross-tenant access while retaining native framework
and data-layer workflows.

Source research: `docs/BRD-PRD.md` and `docs/CLI-RESEARCH.md`. Where those drafts differ from this
feature, this feature is authoritative for initial delivery.

## Users And Use Cases

- Next.js teams using Prisma who need host/header resolution and safe App Router server execution.
- AdonisJS teams using Lucid who expect provider, middleware, Ace, and Japa-native behavior.
- NestJS API teams using Prisma or Sequelize who need request and background-job context.
- Express teams using Prisma, Sequelize, or Knex who need a minimal middleware integration.
- Platform engineers who need diagnostics, repeatable tenant operations, and machine-readable output.

## In Scope

- Framework-neutral core: immutable tenant records, async context, lifecycle, resolvers, events,
  bootstrappers, central context, strict mode, and explicit unsafe bypass boundaries.
- Data-layer adapter contract and stable adapters for Prisma, Sequelize, Knex, and Lucid.
- Framework integration contract and stable integrations for Express, Next.js App Router, NestJS,
  and AdonisJS.
- `@tenancyjs/testing` conformance suites and one runnable example for every advertised stable slice.
- `@tenancyjs/cli` with safe stack detection, `init`, `doctor`, tenant registry operations, leak-test
  execution, and later migration/seed delegation.
- Row-level isolation for the first stable slices; database-per-tenant after row-level isolation and
  operational safety gates pass.
- PostgreSQL as the production integration-test baseline; SQLite may be used for fast local tests
  where behavior is equivalent.
- ESM-first strict TypeScript packages on supported Node.js LTS releases.

## Delivery Order

1. Core and testing contracts.
2. Express + Prisma reference slice and minimal CLI.
3. Next.js + Prisma slice.
4. AdonisJS + Lucid/Knex slice.
5. NestJS + Prisma/Sequelize slice and remaining adapter combinations.
6. Database-per-tenant provisioning and delegated operations.

This order is a quality constraint. A package is not called stable until its conformance and example
tests pass; later packages may exist as experimental without expanding the compatibility promise.

## Non-Goals

- Shipping all framework/adapter combinations in one release.
- Mongoose, Drizzle, TypeORM, Fastify, Bun, Deno, or Next.js Pages Router in the initial commitment.
- Billing, membership authorization, admin UI, hosted services, DNS/SSL automation, or secret storage.
- Transparent interception of arbitrary raw SQL or application-created database clients.
- Schema-per-tenant, PostgreSQL RLS, cache/storage isolation, queues, impersonation, and resource sync
  before the database-per-tenant milestone.
- Replacing Prisma Migrate, Sequelize CLI/Umzug, Knex migrations, Lucid migrations, or Ace.

## Success Measures

- A supported existing application reaches its first isolation test in under 15 minutes.
- Every stable adapter passes a two-tenant no-leak suite for all supported operation classes.
- Every stable framework integration passes concurrent-request and error-cleanup tests.
- `tenancy init --dry-run` is deterministic and a repeated apply produces no unintended changes.
- No compatibility claim exists without a passing CI lane and maintained example.
