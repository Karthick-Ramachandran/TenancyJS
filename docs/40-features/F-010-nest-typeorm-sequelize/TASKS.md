# Tasks: Nest Typeorm Sequelize

## T1: NestJS 11 lifecycle

Status: Ready

Scope:

- Implement ADR-0023 module, route metadata, resolution guard/store, interceptor, errors, and tests.

Acceptance:

- AC-01 through AC-03 pass on both Express and Fastify test applications.

Tests:

- Unit and Nest application lifecycle/concurrency/cancellation/error tests.

Do Not:

- Start implementation before PRD, acceptance, architecture impact, and test plan are clear.

## T2: TypeORM row-level vertical slice

Status: Todo

Scope:
- Protected repository facade, exhaustive classification, shared RLS validation/context, CRUD/count.

Acceptance:
- AC-04/05 pass on real PostgreSQL; unsupported/native surfaces are unreachable.

## T3: TypeORM schema and database strategies

Status: Todo

Scope:
- Bind shared schema engine and resource cache; add real schema/database adversarial evidence.

## T4: Sequelize row-level vertical slice

Status: Todo

Scope:
- Stable Sequelize 6 protected model facade with explicit managed transaction and RLS.

## T5: Sequelize schema and database strategies

Status: Todo

Scope:
- Bind shared engines and prove isolation with real PostgreSQL.

## T6: Cross-stack release evidence

Status: Todo

Scope:
- Nest + adapter E2E, package consumers, capabilities, docs, changesets, reviews, audit, and full gate.
