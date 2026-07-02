# Completion Report: Nextjs Integration

## Status

Complete and ready for merge review.

## Files Changed

- Added `@tenancyjs/integration-next` with separate Node and Edge exports, typed fail-closed errors,
  Route Handler/Server Action wrappers, frozen resolver snapshots, and untrusted hint revalidation.
- Added the Next 16.2 + Prisma 7.8 reference application with dynamic/no-store Route Handler and Server
  Action paths plus PostgreSQL production-start isolation tests.
- Updated package/build/test/pack wiring, security and architecture memory, conventions, and ADR-0009.

## Tests Run

- `pnpm check`: 186 tests passed and 24 environment-specific PostgreSQL tests skipped; coverage passed
  at 96.08% statements, 91.71% branches, 97.22% functions, and 96.49% lines.
- Focused Next integration: 28 tests passed with 100% statements/functions/lines and 98.18% branches.
- Next 16.2.10 production build passed; seven package archives and installed-consumer imports passed.
- `persist doctor` passed with no warnings or errors.

## Results

- AC-NEXT-REF-01 through AC-NEXT-REF-05 pass locally.
- AC-NEXT-REF-06 passes in hosted Node 22/24 PostgreSQL CI on PR #7: all 16 test files and 210 tests
  pass in each lane, including production `next start` Route Handler/Server Action isolation.

## Skipped Checks

- PostgreSQL lanes skipped locally because `TEST_DATABASE_URL` is not configured in this workspace;
  equivalent hosted lanes pass on Node 22 and 24.

## Remaining Risks

- Next runtime/cache behavior can change across releases, so the peer range remains `>=16.2.0 <16.3.0`.
- Identity resolution does not authenticate users or authorize membership; host applications own both.
- Compatibility remains limited to the documented narrow Next 16.2.x peer range.
