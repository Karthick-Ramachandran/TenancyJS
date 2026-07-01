# ADR-0001: Layered Monorepo Package Boundaries

## Status

Accepted

## Context

TenancyJS must support four frameworks and four data layers without coupling their release cycles or
allowing framework/ORM behavior into the tenant context security boundary. The broad source PRD names
packages but does not make dependency direction or compatibility evidence enforceable.

## Decision

Use one pnpm monorepo with separately published packages:

- framework-neutral `core`, `identifiers`, and `testing` packages;
- one public adapter package per data-layer surface: Prisma, Sequelize, Knex, and Lucid;
- one integration package per framework: Express, Next.js, NestJS, and AdonisJS;
- a CLI package whose internal services analyze/patch projects and invoke public APIs/native tools.

Dependency direction is host -> integration -> core <- adapter. Core imports no framework or ORM.
Adapters do not import integrations. Lucid remains a distinct public adapter even if internal Knex
primitives are shared. Stable compatibility is claimed only for CI-tested vertical slices.

## Alternatives Considered

- One universal package: simpler installation, but forces heavy optional dependencies and entangles
  security fixes with every framework and ORM release.
- Framework-first packages containing ORM behavior: convenient for one stack, but duplicates query
  isolation and makes cross-framework conformance unreliable.
- Generic Knex support presented as Lucid support: misses Lucid model hooks, Adonis IoC lifecycle, Ace,
  and Japa behavior.
- Multiple repositories: isolates ownership but fragments changes, testing, issues, and releases early.

## Consequences

Core remains small and testable, peer dependencies stay local, and adapters/integrations can mature at
different rates under one governance model. The cost is more packages, build tooling, module memory,
and compatibility CI. Internal sharing must not erase public capability differences. A monorepo-wide
release policy and package-boundary tests are required.

## Related Documents

- PRD: `docs/00-product/PRD.md`
- Architecture: `docs/10-architecture/ARCHITECTURE.md`
- Security: `docs/20-security/SECURITY_MODEL.md`
- Feature: `docs/40-features/F-001-tenancyjs-platform/ARCHITECTURE_IMPACT.md`
