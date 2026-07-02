# Review: Express Integration

## Status

Local architecture, dependency, conventions, and security review passed without a blocking finding.
Hosted Node 22/24 PostgreSQL verification remains pending until the branch is pushed.

## Architecture Drift Review

- The implementation follows ADR-0001 and ADR-0008: Express behavior is isolated in
  `@tenancyjs/integration-express`, which depends toward core/identifiers and imports no adapter.
- `TenancyManager` remains the only context/lifecycle owner. The integration composes an
  application-owned manager and resolver and adds no process-global/request-global tenant store.
- Response finish, response close, request abort, synchronous dispatch failure, already-finished
  responses, thrown/rejected handlers, and concurrent tenants have explicit evidence.
- The private reference example composes public integration and adapter packages at the application
  boundary. Its base Prisma client remains inside construction/disconnect code and is not passed to
  route construction.
- Product, architecture, security, threat, conventions, lessons, feature, module, package, example,
  testing, and Changeset memory are updated. No undocumented boundary drift remains.

## Security Review

- Only `resolved` outcomes enter `runWithTenant`; missing, malformed, unknown, suspended, ambiguous,
  resolver, and store failures never select central mode or execute tenant routes.
- Request headers are copied into a frozen resolver snapshot. Default errors exclude raw header/host
  values and tenant records; unknown and suspended identities return the same generic 404 mapping.
- Lifecycle settlement is idempotent, removes every finish/close/abort listener, and runs core cleanup
  on success, failure, response close, and real Supertest client abort.
- PostgreSQL HTTP E2E proves tenant-scoped read, create, update, delete, count, and aggregate behavior,
  including failed cross-tenant update/delete attempts and protected-client-only route wiring.
- Runtime integration code performs no logging, telemetry, file writes, secret reads, outbound network
  initiation, cloud/MCP/AI behavior, shell execution, authentication, or authorization. The example
  accepts a host-supplied database URL and does not print it.

## Dependency And Supply-Chain Review

- The published integration has two TenancyJS workspace dependencies, Express 5.2 as a narrow peer,
  and Express types for its public declarations. Supertest and concrete Express are root-only test/dev
  dependencies.
- Express 4 remains outside the claim because its rejected-promise contract differs and has no lane.
- `pnpm audit --audit-level moderate` reports no known vulnerabilities.
- Packed output excludes source, tests, generated clients, and compiler metadata; five tarballs install
  and execute in a clean consumer with install scripts disabled.

## Conventions Review

- Canonical `TenancyManager`, `TenantResolutionOutcome`, `createExpressTenancyMiddleware`,
  `createPrismaTenancyExtension`, and runner-neutral conformance vocabulary are reused.
- The package follows `@tenancyjs/integration-*` naming, core remains framework-neutral, and the example
  does not introduce a competing context or resolver abstraction.
- `createExpressTenancyMiddleware` is recorded in `CONVENTIONS.md`; no unnamed reusable primitive or
  prohibited process-global tenant state was introduced.

## Accepted Tradeoffs And Remaining Risks

- Long-lived responses retain lifecycle resources until finish, close, or abort by design.
- A client abort triggers cleanup, but application async work already created under that request may
  continue with its captured tenant context; host applications own cancellation of abandoned work.
- Cleanup failures after headers are sent reach normal Express headers-sent error handling and cannot
  change the completed response.
- Compatibility is limited to Express 5.2.x and the Express + Prisma 7.8/PostgreSQL 17 slice until
  additional hosted lanes prove otherwise.
