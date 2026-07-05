# Module Tasks: Adapter Shared

## Active Work

- F-009 T9: post-merge isolation review hardening and evidence refresh.

## Tasks

- Complete: package scaffold, shared identifiers/discriminator/RLS/context primitives.
- Complete: PostgreSQL schema strategy and thin Knex binding with adversarial evidence.
- Complete: thin Lucid binding with hook-bypass fail-closed evidence.
- Complete: full PostgreSQL 17 gate, package-consumer verification, dependency audit, and Persist Doctor.
- Complete: ADR-0021 bounded resource-cache foundation with collision, concurrency, eviction, failure,
  lease, and shutdown tests.
- Complete: Knex, Lucid, Prisma, TypeORM, Sequelize, and Mongoose database-per-tenant bindings over the shared cache.
- Complete: optional per-tenant role support and pooled-connection role/search-path reversion evidence.
- Complete: engine-lifetime tenant/schema collision guard and shared deferred-validation warning.
- Complete: Prisma schema-per-tenant via schema-bound Prisma 7 driver clients (ADR-0030).
- Deferred: provisioning; non-PostgreSQL schema dialects are rejected where the namespace does not exist.
