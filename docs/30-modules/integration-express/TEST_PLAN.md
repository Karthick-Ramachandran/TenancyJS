# Module Test Plan: Integration Express

## Unit Tests

- Configuration validation, request adaptation, exhaustive outcome/error mapping, listener cleanup,
  exactly-once settlement, and failure identity.

## Integration Tests

- Portable integration contract through the real middleware.
- Express 5/Supertest success, throw/reject, concurrency, finish, close, and abort cases.
- Clean package consumer and Express + Prisma/PostgreSQL two-tenant E2E.

## Security Tests

- Every unresolved identity fails before downstream execution and never selects central context.
- Not-found and suspended are externally indistinguishable.
- Errors exclude raw identity values, tenant records, rows, secrets, and database URLs.
- Lifecycle cleanup completes after all terminal request paths.
