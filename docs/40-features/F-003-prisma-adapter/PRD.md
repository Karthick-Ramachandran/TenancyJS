# PRD: Prisma Adapter

## Purpose

Provide the first production data-layer isolation boundary for TenancyJS. Applications using Prisma
must be able to expose one extended client whose supported model operations are automatically bound
to the current `TenancyManager` scope and fail closed when no tenant scope exists.

This is the reference implementation for the shared `TenancyAdapter` capability and validation
contract. It proves single-database, row-level tenancy before database-per-tenant work begins.

## Users And Use Cases

- Express, Next.js, and NestJS applications that use Prisma and a shared database.
- Adapter authors who need a concrete capability contract and reusable isolation tests.
- Security reviewers who need explicit evidence for supported, rejected, and unsafe Prisma paths.

## Product Position

The initial release primarily targets greenfield services that can adopt the secured Prisma client
and supported operation matrix from the start. Existing applications migrate incrementally by
inventorying client creation, raw SQL, relation traversal, and nested operations before routing each
compatible path through the secured client.

Fail-closed behavior is the differentiator: when TenancyJS cannot prove that an operation is isolated,
the operation does not execute.

## In Scope

- A minimal framework-neutral `TenancyAdapter` capability/validation type contract.
- `tenancyjs-adapter-prisma` as a shareable Prisma Client query extension.
- Explicit classification of every observed model as tenant-scoped or central.
- Configurable tenant discriminator fields per tenant-scoped model.
- Tenant scoping for supported top-level reads, writes, bulk operations, aggregates, and transactions.
- Typed rejection for missing context, unregistered models, raw queries, tenant-field tampering, and
  unsupported nested relation reads/writes.
- A runner-neutral row-level adapter contract in `tenancyjs-testing` and a real PostgreSQL Prisma
  integration lane.
- Package exports, consumer checks, documentation, Changesets, and security evidence.
- A published Adapter Security Contract, operation matrix, migration guide, and repeatable overhead
  benchmark without an arbitrary performance threshold.

## Non-Goals

- Database-per-tenant connections, provisioning, migrations, or tenant credential management.
- Prisma schema generation or modification by TenancyJS.
- Transparent protection when an application retains or uses the original unextended Prisma client.
- Transparent support for raw SQL, TypedSQL, relation fluent traversal, nested relation reads, or
  nested writes in the initial adapter.
- Framework middleware, authentication, membership authorization, PostgreSQL RLS, or Edge runtimes.
- Compatibility claims beyond versions and operations exercised in CI.
- Static-analysis implementation for `tenancy doctor`; T-04 specifies signals for the later CLI task.
