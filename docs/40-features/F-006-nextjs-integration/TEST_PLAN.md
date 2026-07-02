# Test Plan: Nextjs Integration

## Unit Tests

- Configuration, request snapshots, exhaustive outcomes, typed errors, forged hints, cleanup, and
  stream boundary.

## Integration Tests

- Portable integration contract plus Next production build/start Route Handler and Server Action E2E.
- Prisma/PostgreSQL two-tenant read/write/count isolation and concurrent requests.

## Security Tests

- Edge helper imports no Node/database runtime; forged hints revalidate in Node; no central fallback.
- Cache tests prove tenant-aware keys/no-store and no cross-tenant response reuse.
