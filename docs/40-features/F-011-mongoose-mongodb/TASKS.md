# Tasks: Mongoose Mongodb

## T1: Protected row-level core

Status: Done locally

Scope:

- Package/config/errors/types, exhaustive classification, protected lean model facade, transaction scope.

Acceptance:

- AC-01 through AC-03 pass with focused unit/type tests.

Tests:

- Configuration, pure policy, delegation/no-delegation, redaction, session propagation, type surface.

Do Not:

- Start implementation before PRD, acceptance, architecture impact, and test plan are clear.

## T2: Replica-set adversarial evidence

Status: Done locally

Scope:
- MongoDB 8 single-node replica set, colliding logical-ID CRUD/count, rollback, concurrency, cleanup.

## T3: Database-per-tenant router

Status: Todo

Scope:
- Shared-cache binding, host resource factory, collisions, bounded lifecycle, two-database evidence.

## T4: Release integration

Status: Todo

Scope:
- Capabilities/docs/changeset/module memory/package consumer/full gate/audit/reviews.
