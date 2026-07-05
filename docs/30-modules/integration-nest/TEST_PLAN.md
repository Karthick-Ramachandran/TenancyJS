# Module Test Plan: Integration Nest

## Unit Tests

- Config/metadata, marked/unmarked routes, exact-once resolution, all outcome mappings, guard access,
  interceptor completion/error/unsubscribe, executor composition, and no central fallback.

## Integration Tests

- Nest 11 Express and Fastify test apps: concurrent tenants, handler failure, response completion,
  cancellation, and real adapter-backed two-tenant E2E.
- Nest Express + TypeORM/PostgreSQL uses colliding row IDs and proves concurrent requests observe only
  their tenant while a missing identifier never reaches controller data access.

## Security Tests

- Request metadata and tenant records never appear in errors; WeakMap entries are consumed/removed;
  unmarked/failed requests never enter context; no imperative `enterWith`.
