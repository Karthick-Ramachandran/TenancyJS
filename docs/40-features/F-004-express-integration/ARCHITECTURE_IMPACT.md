# Architecture Impact: Express Integration

## Affected Modules

- New `integration-express` module and `@tenancyjs/integration-express` package.
- Existing `core-tenancy` public lifecycle through `TenancyManager`; no core implementation change.
- Existing `tenant-identifiers` resolution outcomes and request-neutral input types.
- Existing `testing-contracts` portable framework integration suite.
- Existing `prisma-adapter` only through the reference example; the integration never imports it.
- New private `examples/express-prisma` workspace application.

## Dependency Impact

```text
Express application -> integration-express -> core-tenancy
                                    \-------> tenant-identifiers
Express + Prisma example -> integration-express + adapter-prisma
testing contracts -> public integration harness
```

- `express` is a peer dependency and a pinned workspace dev dependency for tests.
- `@tenancyjs/core` and `@tenancyjs/identifiers` are workspace runtime dependencies.
- Supertest and its types are test-only workspace dependencies.
- The initial evidence target is Express 5.2.x; Express 4 is not implied.

## ADR Impact

- ADR-0008 accepts the Express request lifecycle and error contract.
- ADR-0001, ADR-0002, ADR-0005, ADR-0006, and ADR-0007 remain unchanged.
- Implementation follows ADR-0008.

## Security Impact

- Adds an HTTP trust boundary from Express request metadata into tenant resolution.
- Resolution failures fail closed and never infer central context.
- Default errors exclude raw header/host values, tenant records, and store details; not-found and
  suspended share the same external mapping.
- Lifecycle cleanup listens to finish, close, and abort paths and removes listeners exactly once.
- Adds framework dependencies but no telemetry, cloud, AI, MCP, storage, runtime outbound network,
  file-write, secret-reading, or authentication behavior.

## Configuration And Example Impact

- Applications construct and retain the manager, resolution chain, and protected Prisma client.
- The example receives its PostgreSQL URL from the environment and never prints it.
- No production project files are generated or mutated by this task.
