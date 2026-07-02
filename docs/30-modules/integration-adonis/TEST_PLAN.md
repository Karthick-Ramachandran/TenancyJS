# Module Test Plan: Integration Adonis

## Unit Tests

- Config/provider bindings, request snapshots, resolver outcomes, middleware nesting/cleanup/errors,
  Japa helper restoration, Ace delegation, and public types.

## Integration Tests

- AdonisJS 7.3/Lucid 22.4 production HTTP and Japa/API-client tests with PostgreSQL 17 on Node 24.

## Security Tests

- Missing/invalid/unknown/suspended/ambiguous resolution, no central fallback, rollback/release on
  failures, concurrent isolation, streaming boundary, secret-safe output, and CLI file-write attacks.
