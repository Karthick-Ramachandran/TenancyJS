# PRD: TenancyJS

## Purpose

TenancyJS is a TypeScript-first, open-source multi-tenancy toolkit for Node.js applications. It
provides one framework-neutral tenancy model, fail-closed tenant context, data-layer isolation
adapters, framework integrations, testing contracts, and a CLI that scaffolds and operates tenancy
without replacing framework or ORM tooling.

The product exists because Node.js teams repeatedly build tenant resolution, context propagation,
query scoping, and migration loops themselves. Those implementations are inconsistent and can leak
data across tenants. TenancyJS makes the secure path the documented and tested default.

## Current Status

Pre-alpha implementation. Repository foundations and the core tenant lifecycle are implemented; ORM
isolation and framework integrations have not started. The source research is in `docs/BRD-PRD.md`
and `docs/CLI-RESEARCH.md`; delivery status is in
`docs/40-features/F-001-tenancyjs-platform/`.

## Initial Supported Surface

- Frameworks: Express, Next.js App Router, NestJS, and AdonisJS.
- Data layers: Prisma, Sequelize, Knex, and Lucid.
- Isolation: row-level tenancy first; database-per-tenant after the row-level contract is proven.
- Runtime: supported Node.js LTS releases; no Edge-runtime tenant database access guarantee.
- Distribution: separate npm packages in one monorepo, with a `tenancy` CLI.

Support is delivered as tested vertical slices, not as an all-at-once compatibility claim. Express
is the minimal HTTP reference integration; NestJS and Next.js do not substitute for raw Express
support. Lucid is a dedicated adapter surface that may reuse Knex internals but follows AdonisJS
lifecycle and migration conventions.

## Product Principles

- Fail closed when tenant-aware data access has no valid tenant context.
- Never use process-global mutable tenant state.
- Keep core independent from frameworks and ORMs.
- Reuse one adapter contract and one isolation conformance suite.
- Delegate migrations and schema operations to Prisma, Sequelize, Knex, and Lucid tooling.
- Make generated project writes previewable, idempotent, conflict-aware, and secret-safe.
- Claim compatibility only for combinations exercised in CI and examples.

## Non-Goals For The Initial Platform

- Billing, subscription UI, hosted control planes, DNS/SSL automation, or admin dashboards.
- PostgreSQL schema-per-tenant, cache/storage isolation, impersonation, or resource syncing.
- Mongoose, Drizzle, TypeORM, Fastify, or non-Node runtimes in the initial support commitment.
- Transparent protection for arbitrary raw SQL; unsafe escape hatches must be explicit and documented.
