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

The PostgreSQL RLS-backed Knex/Lucid boundary and AdonisJS lifecycle contract are accepted in
ADR-0010 and ADR-0011. `@tenancyjs/adapter-knex` implementation is in progress; no stable
compatibility is claimed until real PostgreSQL evidence passes.

## Architecture

The platform uses a layered monorepo with dependency flow:

```text
applications -> framework integrations -> core <- data-layer adapters
                                      \-> identifiers
CLI -> project analysis/templates + public package APIs
testing -> core contracts + adapter/integration conformance suites
```

Core owns tenant context and lifecycle only. Framework integrations translate request lifecycle into
core calls. Data-layer adapters translate core context into enforced query behavior. The CLI may
compose public APIs and native ORM commands but must not become a second runtime implementation.

Detailed impact and package boundaries are in
`docs/40-features/F-001-tenancyjs-platform/ARCHITECTURE_IMPACT.md`.
