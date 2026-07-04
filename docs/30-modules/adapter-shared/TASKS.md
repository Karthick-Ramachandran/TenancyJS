# Module Tasks: Adapter Shared

## Active Work

- F-009 T2/T3: consolidate isolation primitives and deliver PostgreSQL schema-per-tenant for Knex and
  Lucid.

## Tasks

- Complete: package scaffold, shared identifiers/discriminator/RLS/context primitives.
- Complete: PostgreSQL schema strategy and thin Knex binding with adversarial evidence.
- Complete: thin Lucid binding with hook-bypass fail-closed evidence.
- Complete locally: full PostgreSQL 17 gate, package-consumer verification, dependency audit, and
  Persist Doctor.
- Complete: ADR-0021 bounded resource-cache foundation with collision, concurrency, eviction, failure,
  lease, and shutdown tests.
- In progress: hosted evidence, review handoff, and thin Knex database-per-tenant binding.
- Deferred: ORM database-per-tenant bindings after Knex, provisioning, per-tenant roles, and
  non-PostgreSQL dialects.
