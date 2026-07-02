# Tasks: Express Integration

## T1: Define Scope And Request Lifecycle Contract

Status: In Review

Scope:

- Complete feature/module memory and propose ADR-0008.
- Fix the initial compatibility and dependency targets.

Acceptance:

- PRD, acceptance, architecture impact, plan, test plan, module memory, and ADR are reviewable.
- `persist doctor` passes without stub warnings or errors.

Tests:

- Persist Doctor.

Do Not:

- Start implementation before PRD, acceptance, architecture impact, and test plan are clear.

## T2: Implement Express Middleware And Typed Errors

Status: Blocked on ADR-0008 acceptance.

Scope:

- Add the package, validated factory configuration, request input adapter, exhaustive outcome mapping,
  typed errors, `onError`, and exactly-once lifecycle settlement.

Acceptance:

- AC-EXPRESS-01 through AC-EXPRESS-06.

Tests:

- Unit tests, fake response lifecycle tests, Supertest success/failure/concurrency tests, and portable
  integration contract.

Do Not:

- Attach tenant state to globals, select central context, or resolve lifecycle from `finish` alone.

## T3: Add Express + Prisma Reference Example

Status: Todo.

Scope:

- Build a private runnable example using the protected Prisma client and representative CRUD routes.
- Add real PostgreSQL two-tenant E2E.

Acceptance:

- AC-EXPRESS-08 and AC-EXPRESS-10.

Tests:

- Supertest plus PostgreSQL isolation tests for read/write/count/aggregate and missing/error identities.

Do Not:

- Export or use the unextended Prisma client as application data access.

## T4: Package, Document, And Review The Slice

Status: Todo.

Scope:

- Add package README/LICENSE/changeset, clean-consumer checks, compatibility CI evidence, review, and
  completion records.

Acceptance:

- AC-EXPRESS-07, AC-EXPRESS-09, and platform AC-HTTP-01/AC-COMPAT-01 evidence are complete.

Tests:

- `pnpm check`, audit, package tarball consumer, Node 22/24 PostgreSQL CI, and Persist Doctor.

Do Not:

- Mark the slice stable when any required environment-specific lane is skipped.
