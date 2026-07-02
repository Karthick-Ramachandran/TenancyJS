# Test Plan: Express Integration

## Unit Tests

- Factory rejects missing/invalid manager, resolution service, and error-handler configuration.
- Express headers/host adapt to the existing resolver input without mutation.
- Every `TenantResolutionOutcome` maps exhaustively to the documented typed error code/status.
- Not-found and suspended outcomes produce the same public status/message and exclude identifiers.
- Listener state settles exactly once and removes finish/close/abort listeners.
- Synchronous `next()` failures and custom `onError` failures preserve their error identity.

## Integration Tests

- Run every `createIntegrationTenancyContract` case through the actual Express middleware.
- Supertest success and rejected/throwing handler paths expose context only downstream.
- Two simultaneous delayed requests retain different tenants.
- Response finish, response close, and request abort each complete lifecycle cleanup once.
- Error middleware receives resolution, resolver/store, lifecycle, and application failures.
- Clean package consumer imports ESM exports, compiles types, and handles one request.
- `examples/express-prisma` runs against PostgreSQL and proves cross-tenant read, update, delete, count,
  aggregate, bulk, and transaction isolation through HTTP routes.

## Security Tests

- Missing, malformed, unknown, suspended, and ambiguous identities never invoke downstream tenant routes.
- Raw request values, tenant records, and database URLs do not appear in default error messages.
- No request header/query/path/body value can activate central context.
- The example exposes only the protected extended Prisma client to route handlers.
- Context and bootstrap resources clean up after throws, rejections, close, and abort.

## Compatibility And Release Gates

- Node 22 and Node 24 with Express 5.2.x and Prisma 7.8/PostgreSQL 17.
- Lint, format, typecheck, coverage thresholds, audit, package contents, package consumer, changeset,
  security review, architecture-drift review, and Persist Doctor.
- Express 4 and non-Prisma combinations remain explicitly untested.
