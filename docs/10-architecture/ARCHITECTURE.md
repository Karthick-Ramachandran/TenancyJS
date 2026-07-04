# Architecture

## Purpose

Describe the accepted architecture for this repository.

## Current Status

The layered package architecture, tenant-context model, safe CLI boundary, workspace toolchain, core
lifecycle/error contract, tenant-resolution/testing contracts, and Prisma row-level security boundary
are accepted in ADR-0001 through ADR-0007. The Express request lifecycle/error contract is accepted in
ADR-0008 and implemented by `@tenancyjs/integration-express`.

The safe Express + Prisma CLI foundation implements ADR-0003 through `@tenancyjs/cli`; operational ORM
delegation remains deferred.

The Next.js Node/Edge integration boundary is accepted in ADR-0009 and implemented by
`@tenancyjs/integration-next` with a separate Edge-safe hint export.

The PostgreSQL RLS-backed Knex/Lucid boundary is accepted in ADR-0010, and the AdonisJS 7 integration
(provider, middleware, and testing) contract in ADR-0014. Node 24 is the common repository/package
baseline under ADR-0013. `@tenancyjs/adapter-knex` and `@tenancyjs/adapter-lucid` have hosted
PostgreSQL 17 evidence; the AdonisJS 7 integration layer remains in progress. ADR-0013 supersedes the
earlier mixed-engine compatibility decision, and ADR-0014 extracts the AdonisJS 7 contract out of it.

F-009 adds `@tenancyjs/adapter-shared` under ADR-0019 as the database-dialect strategy boundary.
Knex and Lucid now reuse one PostgreSQL implementation for RLS validation, transaction context, SQL
identifiers, tenant-discriminator decisions, and adapter-enforced schema-per-tenant `search_path`.
ADR-0020 additionally rejects tenant-table shadowing across PostgreSQL's effective default search path.
ADR-0021 defines the bounded shared resource-cache lifecycle for database-per-tenant adapters; the
cache foundation is implemented but no ORM database-per-tenant capability is promoted yet. Core
remains database-neutral.

## Architecture

The platform uses a layered monorepo with dependency flow:

```text
applications -> framework integrations -> core <- data-layer adapters -> adapter-shared
                                      \-> identifiers
CLI -> project analysis/templates + public package APIs
testing -> core contracts + adapter/integration conformance suites
```

Core owns tenant context and lifecycle only. Framework integrations translate request lifecycle into
core calls. Data-layer adapters translate core context into enforced query behavior. The CLI may
compose public APIs and native ORM commands but must not become a second runtime implementation.

Detailed impact and package boundaries are in
`docs/40-features/F-001-tenancyjs-platform/ARCHITECTURE_IMPACT.md`.
