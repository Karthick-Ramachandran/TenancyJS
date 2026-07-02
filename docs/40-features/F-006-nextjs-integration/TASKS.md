# Tasks: Nextjs Integration

## T1: Plan Next Runtime Contract

Status: In Review

Scope:

- Complete F-006/module memory and propose ADR-0009.

Acceptance:

- Public/runtime/security boundaries and tests are reviewable; Doctor passes.

Tests:

- Persist Doctor.

Do Not:

- Start implementation before PRD, acceptance, architecture impact, and test plan are clear.

## T2: Implement Next Integration Package

Status: Blocked on ADR-0009 acceptance.

Scope: Node wrappers, Edge hint helper, typed errors, lifecycle and cache/stream boundaries.

Acceptance: AC-NEXT-REF-01 through AC-NEXT-REF-05.

Tests: Unit/conformance/concurrency/error/forged-hint/cache cases.

## T3: Add Next + Prisma Production Example

Status: Todo.

Scope: App Router Route Handler/Server Action example and production build/start PostgreSQL E2E.

Acceptance: AC-NEXT-REF-06.

Tests: Build/start, HTTP/action isolation, failures, concurrency, and package consumer.
