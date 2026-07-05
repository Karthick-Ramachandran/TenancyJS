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

Beta implementation. Repository foundations, core lifecycle, tenant identification, shared testing
contracts, and the Express, Next.js, AdonisJS 7, and NestJS 11 integrations are implemented. Prisma,
Knex, Lucid, TypeORM, Sequelize, and Mongoose adapters have real-database adversarial evidence. The
reference safe CLI foundation is implemented under F-005, and F-012 adds registry, run, migration, and
provisioning commands through the host runtime contract. The source research is in
`docs/BRD-PRD.md` and
`docs/CLI-RESEARCH.md`; delivery status is in
`docs/40-features/F-001-tenancyjs-platform/`.

Next.js App Router integration is implemented under F-006 and follows accepted ADR-0009; hosted
Node 24 PostgreSQL compatibility evidence passes on PR #7. The Knex/Lucid/AdonisJS vertical slice is
in progress under F-007 and follows accepted ADR-0010/ADR-0013. ADR-0013 sets Node 24 as the common
repository baseline and carries forward the AdonisJS 7 contract. F-009 now implements
adapter-enforced PostgreSQL schema-per-tenant isolation for Knex and Lucid through the shared strategy
engine accepted in ADR-0019. Database-per-tenant is implemented across the supported SQL adapters and
Mongoose; provisioning/migration delegate to host hooks under ADR-0029.

## Initial Supported Surface

- Frameworks: Express, Next.js App Router, NestJS, and AdonisJS.
- Data layers: Prisma, Sequelize, TypeORM, Knex, Lucid, and Mongoose.
- Isolation: row-level; PostgreSQL schema-per-tenant across SQL adapters; database-per-tenant across
  supported SQL databases and MongoDB.
- Runtime: Node.js 24 or newer; no Edge-runtime tenant database access guarantee.
- Distribution: separate npm packages in one monorepo, with a `tenancy` CLI.

Support is delivered as tested vertical slices, not as an all-at-once compatibility claim. Express
is the minimal HTTP reference integration; NestJS and Next.js do not substitute for raw Express
support. Lucid is a dedicated adapter surface that may reuse Knex internals but follows AdonisJS
lifecycle and migration conventions.

## Product Principles

- Make fail-closed enforcement the differentiator: if isolation cannot be proven, do not execute.
- Fail closed when tenant-aware data access has no valid tenant context.
- Never use process-global mutable tenant state.
- Keep core independent from frameworks and ORMs.
- Reuse one adapter contract and one isolation conformance suite.
- Delegate migrations and schema operations to Prisma, Sequelize, Knex, and Lucid tooling.
- Make generated project writes previewable, idempotent, conflict-aware, and secret-safe.
- Claim compatibility only for combinations exercised in CI and examples.
- Keep supported adapter paths identical to native ORM APIs; do not invent a parallel query language.
- Target v1 first at greenfield adoption while providing an explicit incremental migration path for
  existing applications.

## Non-Goals For The Initial Platform

- Billing, subscription UI, hosted control planes, DNS/SSL automation, or admin dashboards.
- Cache/storage isolation, impersonation, or resource syncing.
- Drizzle, Sequelize 7 alpha, or non-Node runtimes in the initial support commitment.
- Transparent protection for arbitrary raw SQL; unsafe escape hatches must be explicit and documented.
