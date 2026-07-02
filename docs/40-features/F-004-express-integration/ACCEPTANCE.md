# Acceptance Criteria: Express Integration

## Criteria

- AC-EXPRESS-01: `createExpressTenancyMiddleware` receives an existing `TenancyManager` and tenant
  resolution service; it does not create hidden process-global or request-global tenancy state.
- AC-EXPRESS-02: Only a `resolved` `TenantResolutionOutcome` enters tenant context. Missing, malformed,
  unknown, suspended, ambiguous, and resolver/store failures never become central context.
- AC-EXPRESS-03: Downstream synchronous and asynchronous handlers observe the immutable resolved tenant,
  while concurrent requests for two tenants never cross context.
- AC-EXPRESS-04: Tenant lifecycle cleanup occurs exactly once after response `finish`, response `close`,
  request abort, or synchronous dispatch failure; `finish` is not the only cleanup path.
- AC-EXPRESS-05: Default resolution errors are typed, contain no tenant record or secret request values,
  and map not-found and suspended outcomes identically. An explicit `onError` hook may integrate with
  application error policy but cannot activate central context.
- AC-EXPRESS-06: Lifecycle, resolver, store, and custom error-handler failures preserve useful error
  identity/cause and reach Express error handling without an unhandled rejection.
- AC-EXPRESS-07: The package passes the runner-neutral integration contract and Supertest tests for
  success, thrown/rejected handlers, concurrency, response close, abort, and every resolution outcome.
- AC-EXPRESS-08: `examples/express-prisma` uses only the protected extended Prisma client and proves on
  PostgreSQL that tenant A cannot read, update, delete, count, or aggregate tenant B records.
- AC-EXPRESS-09: Express 5.2.x, Node 22, and Node 24 lanes, package tarball/consumer checks, docs, and
  `persist doctor` pass before the slice is described as stable.
- AC-EXPRESS-10: The example and public docs state that tenant resolution is not authentication or
  membership authorization and that retained unextended Prisma clients bypass adapter guarantees.

## Out Of Scope

- Express 4 and framework/data-layer combinations without their own CI evidence.
- Streaming APIs beyond lifecycle cleanup on response finish/close and request abort.
- WebSocket upgrades, which require a separate ownership and cleanup contract.
- Database-per-tenant connection switching and operational commands.
