# Review: Prisma Adapter

## Status

Architecture, conventions, dependency, and security review passed with no blocking finding. Hosted
Node 22/24 PostgreSQL CI and Persist Doctor runs pass on PR #6.

## Architecture Drift Review

- The implementation follows ADR-0001 and ADR-0007: core gained data-only adapter vocabulary but no
  Prisma import; `@tenancyjs/adapter-prisma` owns all Prisma behavior; testing remains runner/ORM-neutral.
- The package reads only the supplied `TenancyManager`; it introduces no second context store,
  framework integration, database-per-tenant behavior, migration runner, or schema writer.
- Model/operation capability differences are explicit. The implementation does not claim nested/raw,
  other Prisma versions/providers, other adapters, or framework compatibility.
- Architecture, module, feature, security, testing, conventions, product-status, and Changeset memory
  are updated. No undocumented architecture, module, testing, or documentation drift remains.

## Security Review

- Tenant filters preserve caller selectors and append the tenant predicate; Prisma 7 unique selectors
  remain top-level. Create values are injected/validated and update attempts cannot change the tenant
  field.
- Unknown/overlapping models, unknown operations, missing context, raw operations, configured nested
  relations, and relation traversal fail before query delegation. Central context is lexical and
  central models are explicit.
- Central models also declare relation metadata. Adapter validation warns that a generic extension
  cannot prove manual model/relation classification is exhaustive; schema changes require review.
- Real PostgreSQL negative tests prove cross-tenant unique read/update/delete/upsert behavior, bulk and
  aggregate isolation, interactive/batch transactions, rollback, raw/nested/fluent rejection, and
  explicit central access.
- Only the returned extended client is protected. The README warns that retaining the base client,
  omitting relation metadata, or applying another query extension after TenancyJS is outside the
  guarantee.
- Runtime code performs no logging, telemetry, network initiation, file writes, migration execution,
  secret access, cloud/MCP/AI behavior, or shell invocation. Test database setup uses an argument-array
  process and passes connection configuration through the environment.

## Dependency And Supply-Chain Review

- The published adapter has one workspace runtime dependency and a narrow Prisma Client 7.8 peer
  range. Prisma CLI, PostgreSQL driver, generated client, and Studio React peers are root-only test/dev
  dependencies.
- Prisma's transitive `@hono/node-server` 1.19.11 advisory is overridden to patched 1.19.13; Prisma
  generation, PostgreSQL tests, package checks, and `pnpm audit --audit-level moderate` pass afterward.
- Packed output excludes source/tests/compiler metadata and all four package tarballs execute in a
  clean consumer with install scripts disabled.

## Conventions Review

- Canonical `TenancyManager`, `TenancyAdapter`, `createPrismaTenancyExtension`, and
  `createRowLevelAdapterContract` names are used and recorded in `CONVENTIONS.md`.
- The adapter package follows `@tenancyjs/adapter-*` naming and imports no integration. The testing
  contract uses the existing runner-neutral `{ name, run }` shape and typed assertion error.
- No process-global tenant, duplicated context store, ORM import in core, or untested stable matrix
  claim was introduced.

## Resolved Findings

- PostgreSQL revealed that Prisma `WhereUniqueInput` requires the unique selector at the top level;
  scoping now preserves those fields and appends tenant scope through top-level `AND`.
- Central relation metadata and unknown-operation checks now run before central pass-through.
- Fluent relation traversal received a dedicated cross-tenant PostgreSQL rejection test.
- Manual schema classification and extension registration order are now explicit documented risks.

## Accepted Tradeoffs And Remaining Risks

- Prisma query extensions cannot change generated create input types. TypeScript callers provide the
  non-null tenant field and the adapter validates it; runtime/JavaScript inputs can omit it and receive
  injection.
- Relation-field scanning is conservative and can reject JSON structures containing a configured
  relation-field key. Failing closed is intentional for the initial surface.
- Compatibility is limited to Prisma 7.8/PostgreSQL 17 until additional CI lanes prove otherwise.
