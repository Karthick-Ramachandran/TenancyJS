# Architecture Impact: Prisma Adapter

## Affected Modules

- `core-tenancy`: adds framework/ORM-neutral `TenancyAdapter` capability and validation types only;
  core still imports no Prisma runtime.
- `prisma-adapter`: new package that translates core context into Prisma query arguments and rejects
  unsupported access paths.
- `testing-contracts`: adds a runner-neutral row-level adapter harness and two-tenant contract cases.
- CI/package verification: adds Prisma generation and PostgreSQL integration evidence for the tested
  peer version.

## Dependency Impact

- `@tenancyjs/adapter-prisma` depends on `@tenancyjs/core` and declares Prisma Client as a peer.
- Prisma CLI and the tested client version are development-only workspace dependencies.
- `@tenancyjs/core` gains no runtime dependency. `@tenancyjs/testing` remains ORM-neutral.
- The initial compatibility target is Prisma 7.8.x on the repository's supported Node 22/24 lanes;
  broader peer ranges require their own CI evidence.

## Public Interface Impact

- Core gains data-only adapter name, strategy, capability, and validation-result contracts.
- The Prisma package exposes a configuration validator, typed adapter errors, an operation capability
  description, and `createPrismaTenancyExtension` for use with `prisma.$extends(...)`.
- Configuration explicitly maps tenant-scoped models to discriminator/relation metadata and separately
  allowlists central models. Unclassified models are denied.

## ADR Impact

ADR-0007 accepts the operation matrix, extension boundary, central-context semantics, nested/raw
rejection policy, peer-version policy, and ownership of the generic adapter contract.

## Security Impact

- This module crosses the core-context-to-database trust boundary and becomes a primary tenant-data
  isolation control.
- Caller filters are composed with, never substituted for, tenant predicates. Tenant discriminator
  input is injected or validated and cannot be changed by updates.
- Raw access and Prisma extension paths that cannot be proven safe are rejected. Applications can
  still bypass the adapter by retaining the original client; documentation must make that boundary
  explicit.
- The module adds no telemetry, network service, credential handling, file writes, migration execution,
  authentication, cloud behavior, MCP, or AI APIs.

## Configuration And Template Impact

No application templates or schemas are generated in T-04. Host schemas must already contain the
configured tenant discriminator and appropriate compound indexes/uniques. A later CLI task may inspect
and propose schema changes but cannot silently write them.
