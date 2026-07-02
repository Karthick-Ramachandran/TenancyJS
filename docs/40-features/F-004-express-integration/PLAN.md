# Plan: Express Integration

## Approach

Deliver one narrow Express 5 + Prisma vertical slice over existing core, identifier, adapter, and
testing contracts:

1. Accept ADR-0008 and finalize typed middleware/error interfaces.
2. Implement the middleware lifecycle state machine and exhaustive resolution mapping.
3. Exercise it through the portable integration contract and real Express/Supertest requests.
4. Add the protected-client Prisma example and two-tenant PostgreSQL E2E.
5. Complete package-consumer, compatibility, documentation, security, and Persist reviews.

## Boundaries

- The integration translates HTTP lifecycle into core scopes; it never scopes ORM queries.
- The manager, resolution chain, and adapters are application-owned dependencies.
- Only `resolved` outcomes call `runWithTenant`; no request value can select central mode.
- Wait for finish, close, abort, or dispatch failure instead of assuming `next()` completion means the
  request completed.
- Cleanup settles once and removes listeners on every terminal path.
- Errors and diagnostics never contain raw request values, tenant records, rows, or database URLs.
- Do not claim Express 4, another ORM, or another framework without dedicated evidence.
- Do not push this branch until the user requests it.

## Delivery Order

- P1: Planning and ADR proposal — selected and complete when Doctor passes.
- P2: Integration package and lifecycle tests — blocked on ADR-0008 acceptance.
- P3: Express + Prisma example and PostgreSQL E2E — blocked on P2.
- P4: Packaging, docs, compatibility, and final reviews — blocked on P3.
