# Plan: Nextjs Integration

## Approach

1. Accept ADR-0009 and finalize Node/Edge public interfaces.
2. Implement wrappers, exhaustive resolution errors, and lifecycle tests.
3. Add Next + Prisma production example and PostgreSQL build/start E2E.
4. Add caching/streaming guidance, CLI template support, package evidence, and reviews.

## Boundaries

- No Edge database/context work, trusted raw hints, Pages Router claim, implicit central mode, or shared
  cross-tenant caching. Keep PR #7 as the single draft delivery branch.
